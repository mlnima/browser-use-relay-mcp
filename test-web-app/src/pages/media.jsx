import { useEffect, useRef, useState } from 'react';
import { useLab } from '../context.jsx';
import { Result, Task, useChecks } from '../components/scenario.jsx';
import { Drawing } from '../components/drawing.jsx';

const Media = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['play', 'seek', 'volume', 'video', 'stroke']);
  const audio = useRef(null), video = useRef(null), source = useRef(null), stream = useRef(null), timer = useRef(null);
  const [volume, setVolume] = useState(1); const [position, setPosition] = useState(0); const [error, setError] = useState('');
  useEffect(() => () => { clearInterval(timer.current); stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  const startVideo = async () => {
    clearInterval(timer.current); stream.current?.getTracks().forEach((track) => track.stop());
    let frame = 0; const context = source.current.getContext('2d');
    const draw = () => { context.fillStyle = '#152c30'; context.fillRect(0, 0, 320, 180); context.fillStyle = '#bde3a6';
      context.beginPath(); context.arc(40 + frame % 240, 90, 28, 0, Math.PI * 2); context.fill(); frame += 5; };
    draw(); timer.current = setInterval(draw, 100); stream.current = source.current.captureStream(10); video.current.srcObject = stream.current;
    try { await video.current.play(); } catch (failure) { setError(failure.message); }
  };
  return <><Task>{t('mediaTask')}</Task><div className="two-columns"><div className="panel"><h2>{t('audio')}</h2>
    <audio ref={audio} src="/api/audio" controls preload="metadata" onPlay={() => check('play', true)} onSeeked={() => audio.current.currentTime > 0 && check('seek', audio.current.currentTime)}
      onTimeUpdate={() => setPosition(audio.current.currentTime)} onVolumeChange={() => check('volume', audio.current.volume)} />
    <div className="button-row"><button onClick={() => audio.current.play().catch((failure) => setError(failure.message))}>{t('play')}</button><button onClick={() => audio.current.pause()}>{t('pause')}</button></div>
    <label>{t('volume')}<input type="range" min="0" max="1" step="0.1" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); audio.current.volume = value; }} /></label>
    <label>{t('position')}<input type="range" min="0" max="8" step="0.1" value={position} onChange={(event) => { const value = Number(event.target.value); setPosition(value); audio.current.currentTime = value; }} /></label>
  </div><div className="panel"><h2>{t('video')}</h2><canvas ref={source} width="320" height="180" hidden /><video ref={video} className="live-video" controls muted playsInline onPlaying={() => check('video', true)} />
    <button onClick={startVideo}>{t('startVideo')}</button><button onClick={() => video.current.requestFullscreen().catch((failure) => setError(failure.message))}>{t('fullscreen')}</button></div></div>
    <Drawing onStroke={(points) => check('stroke', { points })} /><Result value={Object.keys(checks).length ? checks : undefined} />{error && <p role="alert">{t('failed')}: {error}</p>}</>;
};
export default Media;
