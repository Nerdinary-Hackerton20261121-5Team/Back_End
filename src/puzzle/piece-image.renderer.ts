import sharp from 'sharp';
import { PIECE_PAD_RATIO, piecePath, type PieceEdges } from './piece-shape.js';

/** 조각 이미지의 칸 너비(px). 원본을 이 크기에 맞춰 줄이거나 늘린다 */
export const PIECE_CELL_WIDTH = 480;

export interface NormalizedImage {
  /** RGBA raw 픽셀 */
  data: Buffer;
  width: number;
  height: number;
}

/**
 * 원본을 회전 보정(EXIF)하고, 칸 너비가 PIECE_CELL_WIDTH가 되도록 크기를 맞춘다.
 * 같은 세션의 조각은 모두 이 결과에서 잘라내므로 한 번 만들어 캐시해 두고 쓴다.
 */
export async function normalizeImage(
  source: Buffer,
  cols: number,
): Promise<NormalizedImage> {
  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: cols * PIECE_CELL_WIDTH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export interface RenderPieceInput {
  image: NormalizedImage;
  rows: number;
  cols: number;
  /** 정답 칸 번호, 왼쪽 위부터 1 */
  position: number;
  edges: PieceEdges;
  /** 0이면 블러 없음(내 조각) */
  sigma: number;
}

/**
 * 조각 하나를 그린다. 결과는 투명 배경 WebP이고 크기는 (칸 + 사방 여유)다.
 * 1) 조각 영역에 블러 여유(3σ)를 더해 잘라낸다. 이미지 밖은 가장자리 픽셀로 채운다.
 * 2) 블러 → 3) 조각 캔버스만 남김 → 4) 조각 모양 밖을 투명하게 지운다.
 * 블러를 마스크 전에 하므로 남의 조각에는 원본 픽셀이 한 개도 남지 않는다.
 */
export async function renderPiece(input: RenderPieceInput): Promise<Buffer> {
  const { image, rows, cols, position, edges, sigma } = input;
  const row = Math.floor((position - 1) / cols);
  const col = (position - 1) % cols;
  const x0 = Math.round((image.width * col) / cols);
  const x1 = Math.round((image.width * (col + 1)) / cols);
  const y0 = Math.round((image.height * row) / rows);
  const y1 = Math.round((image.height * (row + 1)) / rows);
  const cellW = x1 - x0;
  const cellH = y1 - y0;
  const padX = Math.round(cellW * PIECE_PAD_RATIO);
  const padY = Math.round(cellH * PIECE_PAD_RATIO);
  const margin = sigma > 0 ? Math.ceil(sigma * 3) : 0;

  // 1) 캔버스 + 블러 여유 영역
  const want = {
    left: x0 - padX - margin,
    top: y0 - padY - margin,
    width: cellW + 2 * (padX + margin),
    height: cellH + 2 * (padY + margin),
  };
  const clampLeft = Math.max(0, want.left);
  const clampTop = Math.max(0, want.top);
  const clampRight = Math.min(image.width, want.left + want.width);
  const clampBottom = Math.min(image.height, want.top + want.height);

  let region = sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .extract({
      left: clampLeft,
      top: clampTop,
      width: clampRight - clampLeft,
      height: clampBottom - clampTop,
    })
    .extend({
      left: clampLeft - want.left,
      top: clampTop - want.top,
      right: want.left + want.width - clampRight,
      bottom: want.top + want.height - clampBottom,
      extendWith: 'copy',
    });
  // 2) 블러
  if (sigma > 0) region = region.blur(sigma);
  const blurred = await region.raw().toBuffer();

  // 3) 캔버스만 남김
  const canvasW = cellW + 2 * padX;
  const canvasH = cellH + 2 * padY;
  const canvas = await sharp(blurred, {
    raw: { width: want.width, height: want.height, channels: 4 },
  })
    .extract({ left: margin, top: margin, width: canvasW, height: canvasH })
    .raw()
    .toBuffer();

  // 4) 조각 모양 마스크
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">` +
      `<path d="${piecePath(edges, cellW, cellH, padX, padY)}" fill="#fff"/></svg>`,
  );
  return sharp(canvas, {
    raw: { width: canvasW, height: canvasH, channels: 4 },
  })
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();
}
