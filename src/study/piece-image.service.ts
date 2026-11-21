import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDisk, type StorageDisk } from '@nestjs/storage';
import { Repository } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import { blurLevel, blurSigma } from '../puzzle/piece-blur.js';
import {
  normalizeImage,
  renderPiece,
  type NormalizedImage,
} from '../puzzle/piece-image.renderer.js';
import { pieceEdges } from '../puzzle/piece-shape.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { SessionErrors } from '../sessions/sessions.errors.js';
import type { Image } from '../storage/entities/image.entity.js';
import { IMAGES_DISK } from '../storage/storage.config.js';
import { PresenceService } from './presence.service.js';
import { StudyErrors } from './study.errors.js';

export interface PieceImage {
  body: Buffer;
  /** 내 조각이면 null(블러 없음), 남의 조각이면 블러 단계 0~10 */
  blurLevel: number | null;
}

/** 오래된 것부터 버리는 작은 캐시 */
class LruCache<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly limit: number) {}
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) {
      this.map.delete(this.map.keys().next().value!);
    }
  }
}

/**
 * 조각 이미지 (F-008, F-009). 원본은 서버만 읽고, 조각 모양으로 오린 결과만 내려준다.
 * - 내 조각: 블러 없음
 * - 남의 조각: 주인의 복원도에 따른 블러. 100%여도 최소 블러를 남겨 원본을 절대 주지 않는다.
 *   복원도는 참가자 단위라 같은 사람의 조각 2개는 같은 단계로 흐려진다.
 */
@Injectable()
export class PieceImageService {
  /** 크기를 맞춘 원본 (세션 이미지 × 열 수). raw RGBA라 몇 장만 둔다 */
  private readonly sources = new LruCache<Promise<NormalizedImage>>(8);
  /** 완성된 조각 이미지 (세션 × 칸 × 블러 단계) */
  private readonly pieces = new LruCache<Promise<Buffer>>(500);

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
    @InjectRepository(SourcePiece)
    private readonly sourcePieces: Repository<SourcePiece>,
    @InjectDisk(IMAGES_DISK) private readonly disk: StorageDisk,
    private readonly presence: PresenceService,
  ) {}

  async render(
    sessionId: number,
    position: number,
    me: RequestParticipant,
  ): Promise<PieceImage> {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      relations: { image: true },
    });
    if (!session) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    const piece = await this.sourcePieces.findOneBy({ sessionId, position });
    if (!piece || !session.gridRows || !session.gridCols) {
      throw new BusinessException(StudyErrors.PIECE_NOT_FOUND);
    }
    if (!session.image) {
      throw new BusinessException(StudyErrors.SESSION_IMAGE_NOT_SET);
    }

    const level =
      piece.participantId === me.participantId
        ? null
        : blurLevel(await this.ownerRestoration(session, piece.participantId));
    const rows = session.gridRows;
    const cols = session.gridCols;
    const image = session.image;

    const key = `${sessionId}:${image.id}:${rows}x${cols}:${position}:${level ?? 'clear'}`;
    let body = this.pieces.get(key);
    if (!body) {
      body = this.source(image, cols).then((normalized) =>
        renderPiece({
          image: normalized,
          rows,
          cols,
          position,
          edges: pieceEdges(sessionId, position, rows, cols),
          sigma: level === null ? 0 : blurSigma(level),
        }),
      );
      // 실패한 결과는 캐시에 남기지 않는다
      body.catch(() => this.pieces.delete(key));
      this.pieces.set(key, body);
    }
    return { body: await body, blurLevel: level };
  }

  /** 조각 주인의 복원도. 진행판과 같은 판정을 쓴다 (최종값 우선, 없으면 끊김 판정 후 계산, #76) */
  private async ownerRestoration(
    session: Session,
    participantId: number,
  ): Promise<number> {
    const owner = await this.participants.findOneBy({ id: participantId });
    if (!owner) return 0;
    return this.presence.restorationOf(
      owner,
      { startedAt: session.startedAt, goalSeconds: session.goalSeconds },
      new Date(),
    );
  }

  private source(image: Image, cols: number): Promise<NormalizedImage> {
    const key = `${image.id}:${cols}`;
    let normalized = this.sources.get(key);
    if (!normalized) {
      normalized = this.readOriginal(image).then((buffer) =>
        normalizeImage(buffer, cols),
      );
      normalized.catch(() => this.sources.delete(key));
      this.sources.set(key, normalized);
    }
    return normalized;
  }

  private async readOriginal(image: Image): Promise<Buffer> {
    if (image.imageKey) return this.disk.getBuffer(image.imageKey);
    if (image.imageUrl) {
      const res = await fetch(image.imageUrl);
      if (!res.ok)
        throw new Error(`기본 이미지를 읽지 못했습니다: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    throw new BusinessException(StudyErrors.SESSION_IMAGE_NOT_SET);
  }
}
