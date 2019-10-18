import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { StaticQuery, graphql, Link } from 'gatsby';

import './index.scss';
import Footer from './Footer';
import config from '../../../config';
import { googleFontString } from '../../utils/typography';

import favicon from '../../images/favicon.ico';

const Layout = ({ children, data, location }) => (
  <StaticQuery
    query={graphql`
      query SiteTitleQuery {
        site {
          siteMetadata {
            title
            description
          }
        }
      }
    `}
    render={data => {
      let siteUrl;
      location ? (siteUrl = location.href) : (siteUrl = config.siteUrl);

      const setLogoStyle = (titleLogoShow, bioShow) => {
        let logoStyle = {};
        if (titleLogoShow) {
          logoStyle = {
            display: 'inline-block',
          };
        } else {
          logoStyle = {
            display: 'none',
          };
        }
        if (!bioShow) {
          logoStyle = {
            ...logoStyle,
            width: '1.5rem',
            height: '1.5rem',
            marginRight: '0.1rem',
          };
        }
        return logoStyle;
      };
      const logoStyle = setLogoStyle(config.titleLogoShow, config.bioShow);
      const bioStyle = config.bioShow ? {} : { display: 'none' };

      return (
        <>
          <Helmet
            title={data.site.siteMetadata.title}
            meta={[
              { name: 'description', content: config.description },
              { name: 'og:type', content: 'website' },
              { name: 'og:title', content: config.title },
              { name: 'og:description', content: config.description },
              { name: 'og:image', content: config.titleLogo() },
              { name: 'og:url', content: siteUrl },
            ]}
          >
            {/* favicon */}
            <link rel="shortcut icon" href={favicon} />
            {/* html lang set */}
            <html lang="ko" />
            {/* load google font */}
            <link href={`https://fonts.googleapis.com/css?family=${googleFontString}`} rel="stylesheet" />
            {/* Global Site Tag (gtag.js) - Google Analytics */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsTrackingId}`} />
            <script>
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${config.googleAnalyticsTrackingId}');
              `}
            </script>
            {/* google adsense */}
            <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
            {/* naver webmaster */}
            <meta name="naver-site-verification" content="81b46b3e7e3efa805baa5354ab253b3b7c150f19" />
            {/* google verification */}
            <meta name="google-site-verification" content="AcJcTqIN5OS44m3Ujgjnluz5KpG-Dr2MZF4MLFPc_WM" />
          </Helmet>

          <div id="wrap">
            <header id="header">
              <div className="title">
                <div className="title-wrap">
                  <Link to="/">
                    <div className="logo-img" style={logoStyle}>
                      <img src={config.titleLogo()} alt="logo" />
                    </div>
                    <div>
                      <h1>{config.title}</h1>
                      <p className="bio" style={bioStyle}>
                        {config.bio}
                      </p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="menu">
                <div className="home">
                  <Link to="/">
                    <span>Home</span>
                  </Link>
                </div>
                <div className="develop">
                  <Link to="/develop">
                    <span>Develop</span>
                  </Link>
                </div>
                <div className="diary">
                  <Link to="/diary">
                    <span>Diary</span>
                  </Link>
                </div>
                <div className="review">
                  <Link to="/review">
                    <span>Review</span>
                  </Link>
                </div>
                <div className="tags">
                  <Link to="/tags">
                    <span>Tags</span>
                  </Link>
                </div>
              </div>
            </header>

            <article id="article">{children}</article>
          </div>
          <Footer />
        </>
      );
    }}
  />
);

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  location: PropTypes.object.isRequired,
};

export default Layout;
