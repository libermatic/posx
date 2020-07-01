export default function makeExtension(name, ext, namespace = 'posx') {
  const named = `${namespace}.${name}`;
  const _extensions = Object.getPrototypeOf(ext)._extensions || [];
  if (_extensions.includes(named)) {
    return Object.getPrototypeOf(ext);
  }
  ext._extensions = [..._extensions, named];
  return ext;
}
