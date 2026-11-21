import { AssemblyPiece } from '../assembly/entities/assembly-piece.entity.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { Image } from '../storage/entities/image.entity.js';
import { User } from '../users/entities/user.entity.js';

/**
 * 앱이 쓰는 모든 엔티티. 엔티티끼리 관계(FK)로 이어져 있어서, 어느 모듈이 먼저 쓰든
 * 관계 대상이 빠지지 않도록 연결 설정에 한 번에 등록한다. 새 엔티티를 만들면 여기에 추가한다.
 */
export const ENTITIES = [
  User,
  Image,
  Session,
  Participant,
  SourcePiece,
  AssemblyPiece,
];
