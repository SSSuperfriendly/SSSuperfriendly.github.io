// Publication list rendering, shared by the browser (main.js) and the build
// (scripts/build.js). Loaded as a plain script in the browser — which exposes
// `SitePublications` — and as a CommonJS module in Node, so the default
// "Favorite" view can be written into the page at build time and the runtime
// only has to enhance filtering, transitions and viewport re-rendering.
//
// Everything that ends up in markup goes through escapeHTML(), so a stray
// quote or angle bracket in the JSON cannot break an attribute or inject a tag.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SitePublications = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
  }

  // Primary link for mobile paper cards: leaderboard → project → paper
  function getPublicationCardLink(links) {
    if (!links) {
      return '';
    }
    return links.leaderboard || links.project || links.paper || '';
  }

  // Primary link for desktop title: project → paper
  function getPublicationTitleLink(links) {
    if (!links) {
      return '';
    }
    return links.project || links.paper || '';
  }

  function createHighlightsHTML(highlights) {
    if (!Array.isArray(highlights) || highlights.length === 0) {
      return '';
    }

    // Highlights are the one field allowed to carry simple markup (links,
    // emphasis); the data file is maintained by hand, so it is a documented
    // contract rather than an injection surface.
    const items = highlights
      .map(function (item) {
        return `<li>${item}</li>`;
      })
      .join('\n              ');

    return `
          <div class="paper-aside">
            <ul class="paper-highlights">
              ${items}
            </ul>
          </div>`;
  }

  function createPublicationHTMLMobile(pub) {
    const cardLink = getPublicationCardLink(pub.links);
    const tag = cardLink ? 'a' : 'div';
    const hrefAttr = cardLink
      ? ` href="${escapeHTML(cardLink)}" target="_blank" rel="noopener noreferrer"`
      : '';
    const staticClass = cardLink ? '' : ' paper-card--static';

    const mediaHTML = pub.image
      ? `<div class="paper-card__media">
            <img src="${escapeHTML(pub.image)}" alt="${escapeHTML(pub.title)}">
          </div>`
      : '';

    return `
        <${tag}${hrefAttr} class="paper-card fade-in delay-2${staticClass}${pub.image ? '' : ' paper-card--no-media'}">
          ${mediaHTML}
          <div class="paper-card__body">
            <p class="paper-card__title${pub.isPlaceholder ? ' paper-card__title--placeholder' : ''}">${escapeHTML(pub.title)}</p>
            <p class="paper-card__meta">${escapeHTML(pub.venue)}</p>
          </div>
        </${tag}>`;
  }

  // Function to create HTML for a single publication (desktop layout)
  function createPublicationHTMLDesktop(pub, authorLinks) {
    // Generate authors string with automatic links
    let authorsHTML = '';
    (pub.authors || []).forEach(function (author, index) {
      let authorName = escapeHTML(author.name);

      // Check if author has a homepage link
      const authorLink = authorLinks[author.name];
      if (authorLink && authorLink !== '') {
        authorName = `<a href="${escapeHTML(authorLink)}" target="_blank">${authorName}</a>`;
      }

      if (author.isHighlight) {
        authorName = `<u><strong>${authorName}</strong></u>`;
      }

      if (author.isCoFirst) {
        authorName += '*';
      }

      authorsHTML += authorName;

      if (index < pub.authors.length - 1) {
        authorsHTML += ',\n              ';
      }
    });

    // Collect links with display text, then sort by text length descending
    let linkItems = [];
    for (const [linkType, url] of Object.entries(pub.links || {})) {
      if (url && url !== '') {
        let linkText = '';
        switch (linkType) {
          case 'paper': linkText = 'Paper'; break;
          case 'code': linkText = 'Code'; break;
          case 'project': linkText = 'Project'; break;
          case 'demo': linkText = 'Demo'; break;
          case 'benchmark': linkText = 'Benchmark'; break;
          default: linkText = linkType.charAt(0).toUpperCase() + linkType.slice(1);
        }
        linkItems.push({ url: url, text: linkText });
      }
    }
    if (pub.misc && pub.misc.text && pub.misc.link && pub.misc.link !== '') {
      linkItems.push({ url: pub.misc.link, text: pub.misc.text, isMisc: true });
    }
    linkItems.sort(function (a, b) {
      return b.text.length - a.text.length;
    });

    const sidebarLinksHTML = linkItems.map(function (item) {
      const cls = item.isMisc ? 'button misc-button' : 'button';
      const target = item.isMisc ? ' target="_blank"' : '';
      return `<a href="${escapeHTML(item.url)}" class="${cls}"${target}>${escapeHTML(item.text)}</a>`;
    }).join('\n            ');

    const authorsParagraphHTML = authorsHTML
      ? `<p class="paper-authors">${authorsHTML}</p>`
      : '';

    const venueNoBreak = escapeHTML(pub.venue).replace(/\s/g, '&nbsp;');
    let venueText = venueNoBreak;

    // Keep Spotlight on a new line for desktop.
    if (/neurips/i.test(pub.venue) && /spotlight/i.test(pub.venue)) {
      venueText = venueNoBreak
        .replace(/&nbsp;\(Spotlight\)/i, '<br>(Spotlight)')
        .replace(/&nbsp;Spotlight/i, '<br>Spotlight');
    } else {
      venueText = venueNoBreak.replace(/&nbsp;(\([^)]+\))/, '<br>$1');
    }

    const primaryTitleLink = getPublicationTitleLink(pub.links);
    const titleClass = `papertitle${pub.isPlaceholder ? ' papertitle--placeholder' : ''}`;
    const titleHTML = primaryTitleLink
      ? `<a href="${escapeHTML(primaryTitleLink)}" class="${titleClass}" target="_blank" rel="noopener noreferrer">${escapeHTML(pub.title)}</a>`
      : `<span class="${titleClass}">${escapeHTML(pub.title)}</span>`;

    const highlightsHTML = createHighlightsHTML(pub.highlights);
    const imageHTML = pub.image
      ? `<div class="paper-image">
            <img src='${escapeHTML(pub.image)}' alt="${escapeHTML(pub.id)}">
          </div>`
      : '';

    return `
        <div class="paper-container fade-in delay-2${pub.image ? '' : ' paper-container--no-image'}">
          <div class="paper-sidebar">
            <span class="${escapeHTML(pub.venueType)}"><strong>${venueText}</strong></span>
            ${sidebarLinksHTML}
          </div>
          <div class="paper-main">
            ${titleHTML}
            ${authorsParagraphHTML}
          </div>${imageHTML}${highlightsHTML}
        </div>`;
  }

  /** mode: 'mobile' (≤600px cards) or 'desktop' (sidebar layout). */
  function renderPublication(pub, authorLinks, mode) {
    return mode === 'mobile'
      ? createPublicationHTMLMobile(pub)
      : createPublicationHTMLDesktop(pub, authorLinks || {});
  }

  function renderPublications(publications, authorLinks, mode) {
    return publications
      .map(function (publication) {
        return renderPublication(publication, authorLinks, mode);
      })
      .join('');
  }

  return {
    escapeHTML: escapeHTML,
    getPublicationCardLink: getPublicationCardLink,
    getPublicationTitleLink: getPublicationTitleLink,
    createHighlightsHTML: createHighlightsHTML,
    renderPublication: renderPublication,
    renderPublications: renderPublications,
  };
});
