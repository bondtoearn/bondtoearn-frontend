import OlympusLogo from "../../assets/BondToEarn Logo.svg";
import "./notfound.scss";
import { Trans } from "@lingui/macro";

export default function NotFound() {
  return (
    <div id="not-found">
      <div className="not-found-header">
        <a href="https://bondtoearn.com" target="_blank">
          <img className="branding-header-icon" src={OlympusLogo} alt="BondToEarn" />
        </a>

        <h4>
          <Trans>Page not found</Trans>
        </h4>
      </div>
    </div>
  );
}
