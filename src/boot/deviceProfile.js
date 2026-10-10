export const PROFILES = Object.freeze({ full: { dpr: 1.5, shadow: 2048 }, lite: { dpr: 1, shadow: 1024 }, minimal: { dpr: .75, shadow: 512 } });
function read(store, key) { try { return store?.getItem(key); } catch { return null; } }
export function selectDeviceProfile({ search = '', ua = '', coarse = false, deviceMemory, hardwareConcurrency, width = 1920, height = 1080, saved, lost = false, caps } = {}) {
  const query = new URLSearchParams(search);
  const mobile = coarse || /iPhone|iPad|iPod|Android/i.test(ua) || Math.min(width, height) <= 600;
  const lowPower = mobile || deviceMemory <= 4 || hardwareConcurrency <= 6;
  let name = query.get('full') === '1' ? 'full' : query.get('minimal') === '1' ? 'minimal' : query.get('lite') === '1' ? 'lite' : PROFILES[saved] ? saved : lowPower ? 'lite' : 'full';
  // Safety probes and previous GPU loss take priority over quality preferences.
  if (lost || caps && (!caps.rgba16f || !caps.rgba32f)) name = 'minimal';
  return { name, mobile, lowPower, ...PROFILES[name] };
}
export function probeWebGL(gl) {
  const extensions = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'EXT_disjoint_timer_query_webgl2'].filter(name => gl.getExtension(name));
  const previous = { fb: gl.getParameter(gl.FRAMEBUFFER_BINDING), texture: gl.getParameter(gl.TEXTURE_BINDING_2D) };
  function renderable(format, type) {
    const texture = gl.createTexture(), fb = gl.createFramebuffer();
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, format, 4, 4, 0, gl.RGBA, type, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    } catch { return false; } finally { gl.bindFramebuffer(gl.FRAMEBUFFER, previous.fb); gl.bindTexture(gl.TEXTURE_2D, previous.texture); gl.deleteFramebuffer(fb); gl.deleteTexture(texture); }
  }
  const caps = { maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxSamples: gl.getParameter(gl.MAX_SAMPLES), extensions,
    rgba16f: renderable(gl.RGBA16F, gl.HALF_FLOAT), rgba32f: renderable(gl.RGBA32F, gl.FLOAT) };
  for (let i = 0; i < 16 && gl.getError() !== gl.NO_ERROR; i++); // Drain only probe errors.
  return caps;
}
export function detectDeviceProfile(gl) {
  const profile = selectDeviceProfile({ search: location.search, ua: navigator.userAgent, coarse: matchMedia('(pointer: coarse)').matches,
    deviceMemory: navigator.deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency, width: screen.width, height: screen.height,
    saved: read(globalThis.localStorage, 'coverhit-profile'), lost: read(globalThis.sessionStorage, 'coverhit-context-lost') === '1', caps: gl ? probeWebGL(gl) : undefined });
  const query = new URLSearchParams(location.search);
  if (['lite','minimal','full'].some(name=>query.get(name)==='1')) try { localStorage.setItem('coverhit-profile', profile.name); } catch {}
  return profile;
}
