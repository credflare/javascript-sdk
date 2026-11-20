import { CredflareSession } from './index.js';
import {requiresSelfie} from './workflow.js';
import type { SessionDescriptor, SessionInfo } from './index.js';

export function mountSession(element: HTMLElement, descriptor: SessionDescriptor, onReady: (session: CredflareSession, info: SessionInfo) => void): () => void {
  const abort = new AbortController();
  const session = new CredflareSession(descriptor);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading verification requirements…';
  element.replaceChildren(status);
  session.get(abort.signal).then(info => {
    if (abort.signal.aborted) return;
    status.textContent = info.custom_message || 'Your verification is ready.';
    onReady(session, info);
  }).catch((error: unknown) => {
    if (!abort.signal.aborted) status.textContent = error instanceof Error ? error.message : 'Unable to load verification.';
  });
  return () => { abort.abort(); element.replaceChildren(); };
}

export function mountSelfieCapture(element: HTMLElement, session: CredflareSession, info: SessionInfo, onSubmitted: () => void): () => void {
  if (!requiresSelfie(info) || info.profile?.document_requirements.length) throw new Error('Complete the steps requested by your verifier before opening selfie capture.');
  const abort = new AbortController();
  let stream: MediaStream | undefined, photo: Blob | undefined, fileId: number | undefined, previewURL: string | undefined;
  let uploadKey = crypto.randomUUID(), submitKey = crypto.randomUUID(), disposed = false, busy = false;
  const title = document.createElement('h2'), guidance = document.createElement('p'), video = document.createElement('video'), preview = document.createElement('img');
  const status = document.createElement('p'), open = document.createElement('button'), take = document.createElement('button'), send = document.createElement('button');
  title.style.textAlign = guidance.style.textAlign = status.style.textAlign = 'center';
  title.textContent = 'Take a selfie'; guidance.textContent = 'Face the camera in even lighting. Keep your whole face visible and remove anything covering it.';
  status.setAttribute('role', 'status'); preview.alt = 'Your selfie preview'; preview.hidden = true;
  video.autoplay = true; video.muted = true; video.playsInline = true; video.hidden = true;
  open.textContent = 'Open front camera'; take.textContent = 'Take selfie'; send.textContent = 'Send selfie'; take.hidden = true; send.hidden = true;
  for (const button of [open, take, send]) button.type = 'button';
  const privacy = document.createElement('p'); privacy.textContent = `Your selfie will be sent to ${info.requester?.name ?? 'your verifier'} for review.`;
  element.replaceChildren(title, guidance, video, preview, status, open, take, send, privacy);
  const allowed = info.upload_limits.allowed_file_types.filter(type => ['jpg', 'png', 'webp'].includes(type));
  function stop() { stream?.getTracks().forEach(track => track.stop()); stream = undefined; video.srcObject = null; }
  function working(value: boolean) { busy = value; open.disabled = value; take.disabled = value; send.disabled = value; }
  function failure(error: unknown) { if (!disposed) status.textContent = error instanceof Error ? error.message : 'Could not complete this step. Try again.'; }
  if (!allowed.length) { open.disabled = true; status.textContent = 'Your verifier has not enabled a supported selfie image format. Contact them to continue.'; }
  open.onclick = async () => {
    if (busy || disposed) return;
    working(true); status.textContent = '';
    try {
      stop();
      const next = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: 'user', width: {ideal: 1280}, height: {ideal: 1280}}});
      if (disposed) { next.getTracks().forEach(track => track.stop()); return; }
      stream = next; video.srcObject = stream; await video.play();
      video.hidden = false; take.hidden = false; preview.hidden = true; send.hidden = true;
    } catch { stop(); if (!disposed) status.textContent = 'Camera access is unavailable. Allow camera access in your browser and try again.'; }
    finally { if (!disposed) working(false); }
  };
  take.onclick = async () => {
    if (busy || disposed) return;
    working(true);
    try {
      if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is not ready. Try again.');
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d'); if (!context) throw new Error('This browser cannot capture a photo.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const mime = allowed.includes('jpg') ? 'image/jpeg' : allowed.includes('png') ? 'image/png' : 'image/webp';
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.9));
      if (disposed) return;
      if (!blob || blob.type !== mime || !blob.size || blob.size > info.upload_limits.max_file_size_bytes) throw new Error('This photo is empty, too large or in an unsupported format. Retake it.');
      photo = blob; fileId = undefined; uploadKey = crypto.randomUUID(); submitKey = crypto.randomUUID();
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = URL.createObjectURL(blob); preview.src = previewURL; preview.hidden = false;
      stop(); video.hidden = true; take.hidden = true; send.hidden = false; open.textContent = 'Retake selfie'; title.textContent = 'Review your selfie'; status.textContent = 'Make sure your face is clear and fully visible before sharing.';
    } catch (error) { failure(error); }
    finally { if (!disposed) working(false); }
  };
  send.onclick = async () => {
    if (busy || disposed || !photo) return;
    working(true); status.textContent = 'Sending your selfie…';
    try {
      if (fileId === undefined) {
        const form = new FormData(); form.append('capture_source', 'camera'); form.append('file', photo, photo.type === 'image/jpeg' ? 'selfie.jpg' : photo.type === 'image/png' ? 'selfie.png' : 'selfie.webp');
        fileId = (await session.upload('biometrics', form, uploadKey, abort.signal)).id;
      }
      await session.submit({type: 'facial_verification', image_file_id: fileId}, submitKey, abort.signal);
      if (!disposed) { status.textContent = 'Selfie received for review.'; onSubmitted(); }
    } catch (error) { failure(error); if (!disposed) working(false); }
  };
  const visibility = () => { if (document.hidden) { stop(); video.hidden = true; take.hidden = true; } };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', stop);
  return () => { disposed = true; abort.abort(); stop(); if (previewURL) URL.revokeObjectURL(previewURL); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stop); element.replaceChildren(); };
}
