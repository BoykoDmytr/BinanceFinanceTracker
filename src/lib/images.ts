import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const IMAGES_DIR = 'post-images';

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Відкриває галерею, копіює вибрані картинки у сховище застосунку
 * (кеш пікера тимчасовий) і повертає їхні постійні URI.
 */
export async function pickImages(): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    quality: 0.85,
  });
  if (res.canceled) return [];
  const dir = imagesDir();
  const saved: string[] = [];
  for (const asset of res.assets) {
    const ext = asset.uri.includes('.') ? asset.uri.split('.').pop()!.split('?')[0] : 'jpg';
    const name = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const src = new File(asset.uri);
    const dest = new File(dir, name);
    src.copy(dest);
    saved.push(dest.uri);
  }
  return saved;
}

/** Видаляє файли картинок (ігнорує ті, яких уже немає). */
export function deleteImages(uris: string[]): void {
  for (const uri of uris) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // файла вже немає — не страшно
    }
  }
}
