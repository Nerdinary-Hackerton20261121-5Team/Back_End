import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  normalizeImage,
  PIECE_CELL_WIDTH,
  renderPiece,
} from './piece-image.renderer.js';
import type { PieceEdges } from './piece-shape.js';

/** 2열 × 4행, 칸마다 다른 색에 가운데 흰 줄무늬 (블러 여부를 보기 위한 고대비 무늬) */
async function testImage(): Promise<Buffer> {
  const cell = 200;
  const rects: string[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const color = `hsl(${(r * 2 + c) * 45},80%,45%)`;
      rects.push(
        `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${color}"/>`,
      );
      for (let s = 0; s < 10; s++) {
        rects.push(
          `<rect x="${c * cell + 40 + s * 12}" y="${r * cell + 60}" width="6" height="80" fill="#fff"/>`,
        );
      }
    }
  }
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800">${rects.join('')}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}

const edges: PieceEdges = { top: 1, right: -1, bottom: 1, left: 0 };

async function raw(webp: Buffer) {
  return sharp(webp).raw().toBuffer({ resolveWithObject: true });
}

/** 가운데 가로줄의 밝기 변화량 (선명할수록 크다) */
function sharpness(data: Buffer, width: number, height: number): number {
  const y = Math.floor(height / 2);
  let sum = 0;
  for (let x = 1; x < width; x++) {
    const a = (y * width + x) * 4;
    const b = (y * width + x - 1) * 4;
    sum += Math.abs(data[a] - data[b]);
  }
  return sum;
}

describe('renderPiece', () => {
  it('칸 + 사방 20% 여백 크기의 투명 배경 이미지', async () => {
    const image = await normalizeImage(await testImage(), 2);
    expect(image.width).toBe(2 * PIECE_CELL_WIDTH);

    const out = await renderPiece({
      image,
      rows: 4,
      cols: 2,
      position: 3,
      edges,
      sigma: 0,
    });
    const { data, info } = await raw(out);
    expect(info.width).toBe(
      PIECE_CELL_WIDTH + 2 * Math.round(PIECE_CELL_WIDTH * 0.2),
    );
    expect(info.channels).toBe(4);
    // 모서리(조각 밖)는 투명, 가운데(조각 안)는 불투명
    expect(data[3]).toBe(0);
    const center =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
      4;
    expect(data[center + 3]).toBe(255);
  });

  it('블러를 주면 무늬가 뭉개지고, 단계가 강할수록 더 뭉개진다', async () => {
    const image = await normalizeImage(await testImage(), 2);
    const render = (sigma: number) =>
      renderPiece({ image, rows: 4, cols: 2, position: 3, edges, sigma }).then(
        raw,
      );
    const clear = await render(0);
    const light = await render(14);
    const heavy = await render(48);
    const s = (r: Awaited<typeof clear>) =>
      sharpness(r.data, r.info.width, r.info.height);
    expect(s(light)).toBeLessThan(s(clear) / 3);
    expect(s(heavy)).toBeLessThan(s(light));
  });
});
