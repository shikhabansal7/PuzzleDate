// Replays the third-party hosts observed on each embedded game (captured
// 2026-09-11 from a real browser) against AD_SERVING_DOMAINS, so the list
// cannot silently rot again without this failing.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../chrome-extension/background.js", import.meta.url),
  "utf8",
);
const body = source.match(/const AD_SERVING_DOMAINS = \[([\s\S]*?)\n\];/)[1];
const domains = [...body.matchAll(/"([^"]+)"/g)].map(([, d]) => d);
const blocked = (host) => domains.some((d) => host === d || host.endsWith(`.${d}`));

// Hosts that must be blocked: ad exchanges, bidders and ad-identity brokers.
const mustBlock = {
  poople: [
    "cdn.fuseplatform.net", "securepubads.g.doubleclick.net", "ib.adnxs.com",
    "fastlane.rubiconproject.com", "grid-bidder.criteo.com", "rtb.openx.net",
    "hbopenbid.pubmatic.com", "pagead2.googlesyndication.com", "direct.adsrvr.org",
    "i.connectad.io", "g2.gumgum.com", "prg.smartadserver.com",
    "prebid.smilewanted.com", "rt.marphezis.com", "fast.nexx360.io",
    "prebid.a-mo.net", "mp.4dex.io", "onetag-sys.com", "ssc.33across.com",
    "shb.richaudience.com", "exchange.kueezrtb.com", "exchange.cootlogix.com",
    "ads.servenobid.com", "hb.yellowblue.io", "hb-api.omnitagjs.com",
    "cdn.id5-sync.com", "secure.cdn.fastclick.net", "tags.crwdcntrl.net",
    "ep1.adtrafficquality.google", "c.amazon-adsystem.com",
  ],
  unwordle: [
    "go.ezodn.com", "g.ezoic.net", "pbcache.ezoic.com", "cdn.hadronid.net",
    "id.hadron.ad.gt", "launchpad-wrapper.privacymanager.io", "api.rlcdn.com",
    "at.teads.tv", "carbon-cdn.ccgateway.net", "proc.ad.cpe.dotomi.com",
    "d-code.liadm.com", "tlx.3lift.com", "prebid.trustedstack.com",
    "ex.ingage.tech", "id.a-mx.com", "d9.flashtalking.com",
    "secure.quantserve.com", "rules.quantcount.com", "lexicon.33across.com",
    "prebid.cootlogix.com",
  ],
  waffle: [
    "hb.vntsm.com", "hb.vntsm.io", "edge.venatusmedia.com", "edge.atmtd.com",
    "floors.atmtd.com", "scripts.atmtd.com", "btloader.com", "api.btloader.com",
    "ad-delivery.net", "ad.doubleclick.net", "gum.criteo.com",
    "match.adsrvr.org", "link.rubiconproject.com", "sync.crwdcntrl.net",
  ],
  word500: [
    "ads.adthrive.com", "www.npttech.com", "bd.raptivecdn.com",
    "stormgate.production.raptive.com", "prebid-eu.production.adthrive.com",
    "pbs-raptive-eu.ay.delivery", "ssb-global.smartadserver.com",
    "btlr.sharethrough.com", "exchange.postrelease.com", "htlb.casalemedia.com",
    "krk2.kargo.com", "s.seedtag.com", "c2shb.pubgw.yahoo.com",
    "prebid.sv.rkdms.com", "sb.scorecardresearch.com",
    "secure-gl.imrworldwide.com", "feed.pghub.io", "a.teads.tv",
    "pixel.rubiconproject.com", "logger.adthrive.com",
  ],
};

// Hosts that must NOT be blocked: gameplay, login, fonts, analytics, consent.
const mustAllow = [
  "www.googletagmanager.com", "www.google-analytics.com", "analytics.google.com",
  "api.amplitude.com", "cdn.jsdelivr.net", "fonts.googleapis.com",
  "www.gstatic.com", "accounts.google.com", "connect.facebook.net",
  "appleid.cdn-apple.com", "storage.ko-fi.com", "static.cloudflareinsights.com",
  "api.iconify.design", "the.gatekeeperconsent.com", "cdn.jwplayer.com",
  "imasdk.googleapis.com", "www.google.com", "assets.waffle.game",
  "static.waffle.game", "firestore.googleapis.com",
  // The games' own origins must always load.
  "poople.io", "unwordle.org", "wafflegame.net", "word500.com",
  "verticle.netlify.app", "foximax.com", "www.hankgreen.com",
];

const missed = [];
for (const [game, hosts] of Object.entries(mustBlock)) {
  for (const host of hosts) if (!blocked(host)) missed.push(`${game}: ${host}`);
}
assert.deepEqual(missed, [], `ad hosts no longer covered:\n${missed.join("\n")}`);

const overreach = mustAllow.filter(blocked);
assert.deepEqual(overreach, [], `blocking non-ad hosts:\n${overreach.join("\n")}`);

console.log(
  `Ad list covers ${Object.values(mustBlock).flat().length} observed ad hosts ` +
  `across ${Object.keys(mustBlock).length} games, and spares all ${mustAllow.length} gameplay hosts.`,
);
