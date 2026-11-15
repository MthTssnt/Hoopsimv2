import lockup from '../../assets/branding/hoopsim-lockup.svg';
export function HoopSimLogo({ width = 190 }: { width?: number }) {
  return <img className="hoopsim-logo" src={lockup} width={width} alt="HoopSim — Basketball club manager" style={{ imageRendering: 'pixelated', maxWidth: '100%' }} />;
}
