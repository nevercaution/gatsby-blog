let config = {
  title: `nevercaution`,
  author: 'nevercaution',
  description: '작은일기장',
  siteUrl: 'https://nevercaution.github.io',

  // # Header config
  titleLogo: () => {
    return require('./src/images/profile.png');
  },
  titleLogoShow: true,
  bio: 'Why be normal?',
  bioShow: true,

  // # Addtional
  googleAnalyticsTrackingId: 'UA-100815581-1',
  disqusShortname: 'nevercaution',

  // ## google AdSense
  // In addition, client-id in '/static/ads.txt' file needs to be modified
  googleAdsense: true,
  adsenseClient: 'pub-2516810533693172',
  adsenseSlot: '5544246730',

  // naver
  naverWebmasterId: '81b46b3e7e3efa805baa5354ab253b3b7c150f19',
};

/********************************************** */

if (process.env.NODE_ENV === 'development') {
  config.googleAnalyticsTrackingId = '';
  config.disqusShortname = '';
  config.googleAdsense = false;
  sconfig.naverWebmasterId = '';
}

module.exports = config;
