import { Icon, type IconName } from "@/components/icons";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { CountUp } from "@/components/reactbits/CountUp";

/**
 * Card de métrica. Quando o valor é numérico (`count`), ele entra contando com o
 * CountUp do React Bits; o cartão inteiro ganha o brilho do SpotlightCard sob o
 * cursor. Texto continua sendo aceito em `value` para os casos não numéricos.
 */
export function Metric({
  icon,
  label,
  value,
  count,
  prefix,
  suffix,
  delta,
  tone = "flat",
}: {
  icon: IconName;
  label: string;
  value?: React.ReactNode;
  count?: number;
  prefix?: string;
  suffix?: string;
  delta?: string;
  tone?: "up" | "down" | "flat";
}) {
  return (
    <SpotlightCard className="metric">
      <div className="mlab">
        <span className="mi">
          <Icon name={icon} />
        </span>{" "}
        {label}
      </div>
      <div className="mval">
        {typeof count === "number" ? <CountUp to={count} prefix={prefix} suffix={suffix} /> : value}
      </div>
      {delta && <div className={"mdelta " + tone}>{delta}</div>}
    </SpotlightCard>
  );
}
