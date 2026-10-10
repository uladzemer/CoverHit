export function reduceMobileScene(yard, profile) {
  if (profile === 'full') return;
  yard.root.traverse(object => {
    if (!object.isMesh) return;
    const material = object.material;
    if (object.isInstancedMesh && [yard.materials.blades, yard.materials.foliage].includes(material)) {
      object.userData.mobileCount ??= object.count;
      object.count = Math.ceil(object.userData.mobileCount * (profile === 'minimal' ? .25 : .5));
    }
    if (object.name === 'laundry-cloth') {
      object.userData.mobileCount ??= object.count;
      object.count = Math.ceil(object.userData.mobileCount * .5);
    }
    // Far-ring houses already use the backdrop's photographed impostor boxes.
    if (object.parent === yard.backdrop.group) {
      object.castShadow = false;
      if (object.isInstancedMesh && material?.isMeshBasicMaterial && material.map && material.alphaTest) {
        object.userData.mobileCount ??= object.count;
        object.count = Math.ceil(object.userData.mobileCount * (profile === 'minimal' ? .25 : .5));
      }
    }
  });
}
