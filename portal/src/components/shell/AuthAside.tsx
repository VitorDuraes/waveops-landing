import Link from "next/link";
import { BrandMark, Icon } from "@/components/icons";

// Aside escuro (sempre escuro) das telas de login, com pitch e bullets.
export function AuthAside({
  pitchH,
  pitchP,
  points,
}: {
  pitchH: string;
  pitchP: string;
  points: string[];
}) {
  return (
    <div className="auth-aside">
      <div className="glow" />
      <Link className="brand" href="https://waveops.com.br/">
        <BrandMark size={34} /> Wave<span className="v">Ops</span>
      </Link>
      <div className="auth-pitch">
        <h2>{pitchH}</h2>
        <p>{pitchP}</p>
        <ul className="auth-points">
          {points.map((p, i) => (
            <li key={i}>
              <Icon name="check" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--dim)", position: "relative" }}>
        © 2026 WaveOps · Automação, sistemas e IA
      </div>
    </div>
  );
}
