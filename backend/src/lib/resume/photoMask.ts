import sharp from 'sharp';

export async function circleMaskPng(inputBytes: Uint8Array, size: number): Promise<Uint8Array> {
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  const masked = await sharp(Buffer.from(inputBytes))
    .resize(size, size)
    .png()
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return new Uint8Array(masked);
}
