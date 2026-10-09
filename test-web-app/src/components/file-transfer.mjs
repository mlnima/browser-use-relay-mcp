export const uploadFiles = async (files) => {
  const results = [];
  for (const file of files) {
    const response = await fetch(`/api/upload?name=${encodeURIComponent(file.webkitRelativePath || file.name)}`, { method: 'POST', body: file });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    results.push(await response.json());
  }
  return results;
};
export const downloadFile = async (url, filename) => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob(); const href = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = href; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
  return { filename, bytes: blob.size };
};
