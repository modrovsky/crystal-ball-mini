// Noun SVG generation — builds pixel-art SVGs from seed data
// Extracted from @noundry/nouns-assets pipeline
import pkg from '@noundry/nouns-assets';
const { ImageData, getNounData } = pkg;

/**
 * Decode an RLE-encoded image part into drawing instructions.
 */
function decodeImage(image) {
  const data = image.replace(/^0x/, '');
  const bounds = {
    top: parseInt(data.substring(2, 4), 16),
    right: parseInt(data.substring(4, 6), 16),
    bottom: parseInt(data.substring(6, 8), 16),
    left: parseInt(data.substring(8, 10), 16),
  };
  const rects =
    data
      .substring(10)
      .match(/.{1,4}/g)
      ?.map((rect) => [
        parseInt(rect.substring(0, 2), 16),
        parseInt(rect.substring(2, 4), 16),
      ]) ?? [];
  return { bounds, rects };
}

/**
 * Build a 320x320 SVG string from decoded noun parts.
 * @param {Array} parts - Array of { data } objects from getNounData()
 * @param {string[]} paletteColors - Hex color palette
 * @param {string} [bgColor] - Background hex color (without #)
 * @returns {string} Complete SVG markup
 */
export function buildSVG(parts, paletteColors, bgColor) {
  const svgRects = parts.reduce((result, part) => {
    const { bounds, rects } = decodeImage(part.data);
    let currentX = bounds.left;
    let currentY = bounds.top;

    for (const [drawLength, colorIndex] of rects) {
      let remaining = drawLength;
      while (remaining > 0) {
        const length = Math.min(remaining, bounds.right - currentX);
        if (colorIndex !== 0) {
          result.push(
            `<rect width="${length * 10}" height="10" x="${currentX * 10}" y="${currentY * 10}" fill="#${paletteColors[colorIndex]}" />`
          );
        }
        currentX += length;
        if (currentX === bounds.right) {
          currentX = bounds.left;
          currentY++;
        }
        remaining -= length;
      }
    }
    return result;
  }, []);

  const bg = bgColor ? `#${bgColor}` : 'none';
  return [
    `<svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="${bg}" />`,
    ...svgRects,
    `</svg>`,
  ].join('');
}

/**
 * Generate a full noun SVG from a seed.
 * @param {{ background: number, body: number, accessory: number, head: number, glasses: number }} seed
 * @returns {{ svg: string, parts: Array, background: string, seed: object }}
 */
export function generateNoun(seed) {
  const nounData = getNounData(seed);
  const svg = buildSVG(nounData.parts, ImageData.palette, nounData.background);
  return {
    svg,
    parts: nounData.parts,
    background: nounData.background,
    seed,
  };
}

/**
 * Trait names for each index, pulled from the asset library.
 */
export const traitNames = {
  backgrounds: ImageData.bgcolors,
  bodies: ImageData.images.bodies.map((b) => b.filename),
  accessories: ImageData.images.accessories.map((a) => a.filename),
  heads: ImageData.images.heads.map((h) => h.filename),
  glasses: ImageData.images.glasses.map((g) => g.filename),
};
