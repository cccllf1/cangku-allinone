export const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  // Ensure window is defined (for server-side rendering or testing environments)
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.protocol + '//' + window.location.host
    : ''; 
  return baseUrl + cleanPath;
}; 