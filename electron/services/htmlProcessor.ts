import * as cheerio from 'cheerio'
import sharp from 'sharp'

/**
 * Re-encode all base64 images in an HTML string at the given JPEG quality.
 * Only re-encodes JPEG and PNG data URIs. SVG and other formats are left as-is.
 */
export async function reencodeImages(html: string, quality: number): Promise<string> {
  if (quality >= 100) return html

  const $ = cheerio.load(html, { xmlMode: false })
  const tasks: Promise<void>[] = []

  // Process <img src="data:...">
  $('img[src]').each((_i, el) => {
    const src = $(el).attr('src') || ''
    if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/png') || src.startsWith('data:image/jpg')) {
      const task = reencodeDataUri(src, quality).then(newSrc => {
        $(el).attr('src', newSrc)
      }).catch(() => {})
      tasks.push(task)
    }
  })

  // Process inline style background-image: url("data:...")
  $('[style]').each((_i, el) => {
    const style = $(el).attr('style') || ''
    const dataUriMatches = [...style.matchAll(/url\(["']?(data:image\/(jpeg|jpg|png);base64,[^"')]+)["']?\)/gi)]
    for (const match of dataUriMatches) {
      const dataUri = match[1]
      const task = reencodeDataUri(dataUri, quality).then(newUri => {
        const currentStyle = $(el).attr('style') || ''
        $(el).attr('style', currentStyle.replace(dataUri, newUri))
      }).catch(() => {})
      tasks.push(task)
    }
  })

  await Promise.all(tasks)
  return $.html()
}

async function reencodeDataUri(dataUri: string, quality: number): Promise<string> {
  const match = dataUri.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) return dataUri

  const mimeType = match[1]
  const base64Data = match[2]

  // Skip SVG
  if (mimeType === 'image/svg+xml') return dataUri

  const buffer = Buffer.from(base64Data, 'base64')
  let newBuffer: Buffer

  try {
    newBuffer = await sharp(buffer).jpeg({ quality }).toBuffer()
    const newBase64 = newBuffer.toString('base64')
    return `data:image/jpeg;base64,${newBase64}`
  } catch {
    return dataUri
  }
}
