/** Browser metadata is an early UX check; only the signed provider event is authoritative. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const finish = (duration?: number) => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (duration !== undefined) resolve(duration);
      else reject(new Error("No se pudo leer la duración. Prueba con un archivo MP4 compatible."));
    };
    const timeout = setTimeout(() => finish(), 15_000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish();
    video.src = url;
  });
}
