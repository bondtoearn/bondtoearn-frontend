import { ReactComponent as ForumIcon } from "../../assets/icons/forum.svg";
import { ReactComponent as GovIcon } from "../../assets/icons/governance.svg";
import { ReactComponent as DocsIcon } from "../../assets/icons/docs.svg";
import { ReactComponent as BridgeIcon } from "../../assets/icons/bridge.svg";
import { SvgIcon } from "@material-ui/core";
import { Trans } from "@lingui/macro";

const externalUrls = [
  // {
  //   title: <Trans>Forum</Trans>,
  //   url: "https://forum.bondtoearn.com/",
  //   icon: <SvgIcon color="primary" component={ForumIcon} />,
  // },
  // {
  //   title: <Trans>Governance</Trans>,
  //   url: "https://vote.bondtoearn.com/",
  //   icon: <SvgIcon color="primary" component={GovIcon} />,
  // },
  {
    title: <Trans>Docs</Trans>,
    url: "https://docs.bondtoearn.com/",
    icon: <SvgIcon color="primary" component={DocsIcon} />,
  },
];

export default externalUrls;
