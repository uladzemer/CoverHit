import * as THREE from 'three';
export let activeProfile = 'full';
export let mobileDevice = false;
export function setAssetProfile(name, mobile) { activeProfile = name; if (typeof mobile === 'boolean') mobileDevice = mobile; }
export function liteAssetURL(url) {
  const base = import.meta.env?.BASE_URL || '/';
  return `${base}lite/${url.slice(base.length).replace(/\.(jpg|jpeg|png)$/i, '.webp')}`;
}
// A missing derivative still has a bounded GPU size, even with full fallback.
export async function loadProfileTexture(loader, url) {
  let texture;
  if (activeProfile !== 'full') {
    try { texture = await loader.loadAsync(liteAssetURL(url)); } catch {}
  }
  texture ||= await loader.loadAsync(url);
  if (activeProfile !== 'full') {
    const image = texture.image, max = Math.max(image.width, image.height);
    if (max > 1024) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * 1024 / max)); canvas.height = Math.max(1, Math.round(image.height * 1024 / max));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); texture.image = canvas; texture.needsUpdate = true;
    }
  }
  return texture;
}
export function estimateTextureBytes(scene) {
  const seen = new Set(); let bytes = 0;
  const visit = value => {
    if (!value?.isTexture || seen.has(value)) return;
    seen.add(value);
    const images = Array.isArray(value.image) ? value.image : [value.image];
    for (const image of images) bytes += (image?.width || 0) * (image?.height || 0) * 4 * (value.generateMipmaps ? 4 / 3 : 1) * (value.type === THREE.FloatType ? 4 : value.type === THREE.HalfFloatType ? 2 : 1);
  };
  scene.traverse(object => {
    for (const material of [object.material, object.customDepthMaterial].flat()) if (material) {
      Object.values(material).forEach(visit);
      Object.values(material.uniforms || {}).forEach(uniform => visit(uniform.value));
    }
  });
  visit(scene.environment); visit(scene.background); return bytes;
}
