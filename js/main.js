// Site JavaScript: sticky nav + smooth scrolling.
// Nav links are written as /#Anchor so they work from any subpage:
// if the anchor exists on the current page we scroll to it, otherwise we
// navigate to the homepage and let the browser land on the anchor.

var navScrollRafId = null;

var navAnchorOffset = {
  desktop: 40,
  mobile: 76
};

function updateSiteNav() {
  var nav = document.getElementById('site-nav');
  if (nav) {
    nav.classList.toggle('is-floating', window.scrollY > 20);
  }
}

function handleSiteNavScroll() {
  if (navScrollRafId !== null) {
    return;
  }
  navScrollRafId = requestAnimationFrame(function() {
    navScrollRafId = null;
    updateSiteNav();
  });
}

function initSiteNav() {
  var nav = document.getElementById('site-nav');
  updateSiteNav();
  window.addEventListener('scroll', handleSiteNavScroll, { passive: true });

  if (!nav) {
    return;
  }

  nav.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(function(link) {
    link.addEventListener('click', function(event) {
      var href = link.getAttribute('href');
      var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '';
      var isHomeAnchor = href.charAt(0) === '/';
      var onHome = window.location.pathname === '/'
        || window.location.pathname === '/index.html';
      var target = hash ? document.querySelector(hash) : null;

      // /#hash links always target homepage sections. Every subpage has its
      // own #Top, so a bare existence check would wrongly treat them as local
      // and never navigate home (e.g. About Me dead on /news/#Top).
      if (isHomeAnchor && !onHome) {
        window.location.href = '/' + hash;
        return;
      }

      if (!target) {
        // The anchor lives on the homepage — go there (falls back to the
        // browser's native fragment navigation once the page loads).
        window.location.href = '/' + hash;
        return;
      }

      event.preventDefault();
      var layout = window.innerWidth <= 600 ? 'mobile' : 'desktop';
      var targetTop = target.getBoundingClientRect().top
        + window.scrollY
        - navAnchorOffset[layout];
      var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      history.pushState(null, '', hash);
    });
  });
}

initSiteNav();

// ================================================================
// Research section: publications loaded at runtime from /data/.
// Ported from the template site (HaoquanZhang) main.js, adapted to
// this site: absolute data URLs, filters matching the user's own
// research topics, and the nav helpers left to the code above.
// ================================================================

let authorLinks = {};
let allPublications = [];
let currentPublicationLayoutMode = 'desktop';
let researchResizeRafId = null;
let researchTransitionTimer = null;
const showResearchLineDescriptions = false;
let placeholderTitleTimer = null;
let activePlaceholderTitle = null;

const placeholderTitleIdeas = [
  'High-Performance AI',
  'AI Systems',
  'AI for Science',
  'AI for Sustainability'
];

const researchLineContent = {
  selected: {
    description: 'Selected projects on high-performance AI and AI systems.'
  },
  'high-performance-ai': {
    description: 'Making AI training and inference faster and more efficient.'
  },
  'ai-systems': {
    description: 'Designing AI systems and the infrastructure that runs them.'
  }
};

function getPublicationLayoutMode() {
  return window.innerWidth <= 600 ? 'mobile' : 'desktop';
}

function getActiveResearchFilter() {
  const activeButton = document.querySelector('.research-filter__btn.is-active');
  return activeButton ? activeButton.dataset.filter : 'selected';
}

function syncPublicationLayoutMode() {
  const nextMode = getPublicationLayoutMode();
  if (nextMode === currentPublicationLayoutMode) {
    return false;
  }

  currentPublicationLayoutMode = nextMode;
  setResearchFilter(getActiveResearchFilter(), true);
  return true;
}

function handleResearchResize() {
  if (researchResizeRafId !== null) {
    return;
  }

  researchResizeRafId = requestAnimationFrame(function() {
    researchResizeRafId = null;
    const layoutChanged = syncPublicationLayoutMode();
    if (!layoutChanged) {
      updateResearchFilterIndicator();
    }
  });
}

// Function to load author links
async function loadAuthorLinks() {
  try {
    const response = await fetch('/data/authors.json');
    authorLinks = await response.json();
  } catch (error) {
    console.error('Error loading author links:', error);
  }
}

function publicationMatchesFilter(publication, filter) {
  if (!publication.show) {
    return false;
  }
  const topics = publication.topics || [];
  return topics.includes(filter);
}

function renderPublicationList(publications) {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }

  stopPlaceholderTitleCycle(false);
  container.innerHTML = publications
    .map(function(publication) {
      return createPublicationHTML(publication);
    })
    .join('');
  initPlaceholderTitleEffects(container);
}

function stopPlaceholderTitleCycle(restoreTitle) {
  if (restoreTitle === undefined) {
    restoreTitle = true;
  }
  if (placeholderTitleTimer !== null) {
    clearTimeout(placeholderTitleTimer);
    placeholderTitleTimer = null;
  }

  const title = activePlaceholderTitle;
  activePlaceholderTitle = null;
  if (!title) {
    return;
  }

  title.classList.remove('is-typing');
  if (restoreTitle) {
    title.textContent = title.dataset.originalTitle;
  }
}

function startPlaceholderTitleCycle(title) {
  stopPlaceholderTitleCycle(false);
  title.textContent = title.dataset.originalTitle;
  title.classList.remove('is-typing');
  activePlaceholderTitle = title;
  let ideaIndex = 0;

  function typeFinalTitle(characterIndex) {
    if (characterIndex === undefined) {
      characterIndex = 0;
    }
    if (activePlaceholderTitle !== title) {
      return;
    }

    const finalTitle = title.dataset.originalTitle;
    title.classList.add('is-typing');
    title.textContent = finalTitle.slice(0, characterIndex);

    if (characterIndex < finalTitle.length) {
      const nextCharacterDelay = characterIndex === 9 ? 450 : 65;
      placeholderTitleTimer = setTimeout(function() {
        typeFinalTitle(characterIndex + 1);
      }, nextCharacterDelay);
      return;
    }

    title.classList.remove('is-typing');
    placeholderTitleTimer = null;
  }

  function showNextIdea() {
    if (activePlaceholderTitle !== title) {
      return;
    }

    if (ideaIndex < placeholderTitleIdeas.length) {
      title.textContent = placeholderTitleIdeas[ideaIndex];
      ideaIndex += 1;
      placeholderTitleTimer = setTimeout(showNextIdea, 85);
      return;
    }

    typeFinalTitle();
  }

  placeholderTitleTimer = setTimeout(showNextIdea, 240);
}

function initPlaceholderTitleEffects(container) {
  container.querySelectorAll('.paper-container').forEach(function(publication) {
    const title = publication.querySelector('.papertitle--placeholder');
    if (!title) {
      return;
    }

    title.dataset.originalTitle = title.textContent;
    publication.addEventListener('mouseenter', function() {
      startPlaceholderTitleCycle(title);
    });
    publication.addEventListener('mouseleave', function() {
      stopPlaceholderTitleCycle(true);
    });
  });
}

function updateResearchFilterIndicator() {
  const filter = document.querySelector('.research-filter');
  if (!filter || window.innerWidth <= 600) {
    return;
  }

  const indicator = filter.querySelector('.research-filter__indicator');
  const activeButton = filter.querySelector('.research-filter__btn.is-active');
  if (!indicator || !activeButton) {
    return;
  }

  const filterRect = filter.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  indicator.style.left = buttonRect.left - filterRect.left + 'px';
  indicator.style.width = buttonRect.width + 'px';
}

function updateResearchContent(normalized, filteredPublications) {
  const container = document.getElementById('publications-container');
  const lineContent = researchLineContent[normalized] || researchLineContent.selected;
  const intro = document.querySelector('.research-line-intro');
  const introDescription = document.getElementById('research-line-description');

  if (intro && introDescription) {
    const showIntro = showResearchLineDescriptions && normalized !== 'selected';
    introDescription.textContent = lineContent.description;
    intro.classList.toggle('is-visible', showIntro);
    intro.setAttribute('aria-hidden', showIntro ? 'false' : 'true');

    if (showIntro) {
      introDescription.classList.remove('is-entering');
      void introDescription.offsetWidth;
      introDescription.classList.add('is-entering');
    }
  }

  renderPublicationList(filteredPublications);

  if (container) {
    void container.offsetWidth;
    container.classList.remove('is-leaving');
  }
  if (intro) {
    intro.classList.remove('is-leaving');
  }
}

function setResearchFilter(filter, skipTransition) {
  if (skipTransition === undefined) {
    skipTransition = false;
  }
  const normalized = filter || 'selected';
  const filteredPublications = allPublications.filter(function(publication) {
    return publicationMatchesFilter(publication, normalized);
  });

  const container = document.getElementById('publications-container');
  const intro = document.querySelector('.research-line-intro');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldFadeOut = !skipTransition
    && !prefersReducedMotion
    && container
    && container.children.length > 0;

  document.querySelectorAll('.research-filter__btn').forEach(function(button) {
    const isActive = button.dataset.filter === normalized;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  requestAnimationFrame(updateResearchFilterIndicator);

  try {
    localStorage.setItem('research-filter', normalized);
  } catch (error) {
    // Ignore storage errors in private browsing.
  }

  if (researchTransitionTimer !== null) {
    clearTimeout(researchTransitionTimer);
    researchTransitionTimer = null;
  }

  if (!shouldFadeOut) {
    updateResearchContent(normalized, filteredPublications);
    return;
  }

  container.classList.add('is-leaving');
  if (intro && intro.classList.contains('is-visible')) {
    intro.classList.add('is-leaving');
  }

  researchTransitionTimer = setTimeout(function() {
    researchTransitionTimer = null;
    updateResearchContent(normalized, filteredPublications);
  }, 160);
}

function initResearchFilter() {
  // Always default to Favorite ("selected") on every page load / refresh —
  // the last-selected filter is intentionally NOT restored from localStorage.
  const savedFilter = 'selected';

  document.querySelectorAll('.research-filter__btn').forEach(function(button) {
    button.addEventListener('click', function() {
      setResearchFilter(button.dataset.filter);
    });
  });

  currentPublicationLayoutMode = getPublicationLayoutMode();
  window.addEventListener('resize', handleResearchResize);

  setResearchFilter(savedFilter, true);
}

// Function to render publications from JSON data
async function renderPublications() {
  try {
    await loadAuthorLinks();
    const response = await fetch('/data/publications.json');
    allPublications = await response.json();
    initResearchFilter();
  } catch (error) {
    console.error('Error loading publications:', error);
  }
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

function createPublicationHTMLMobile(pub) {
  const cardLink = getPublicationCardLink(pub.links);
  const tag = cardLink ? 'a' : 'div';
  const hrefAttr = cardLink
    ? ` href="${cardLink}" target="_blank" rel="noopener noreferrer"`
    : '';
  const staticClass = cardLink ? '' : ' paper-card--static';

  const mediaHTML = pub.image
    ? `<div class="paper-card__media">
            <img src="${pub.image}" alt="${pub.title}">
          </div>`
    : '';

  return `
        <${tag}${hrefAttr} class="paper-card fade-in delay-2${staticClass}${pub.image ? '' : ' paper-card--no-media'}">
          ${mediaHTML}
          <div class="paper-card__body">
            <p class="paper-card__title${pub.isPlaceholder ? ' paper-card__title--placeholder' : ''}">${pub.title}</p>
            <p class="paper-card__meta">${pub.venue}</p>
          </div>
        </${tag}>`;
}

// Function to create HTML for a single publication (desktop layout)
function createPublicationHTMLDesktop(pub) {
  // Generate authors string with automatic links
  let authorsHTML = '';
  pub.authors.forEach(function(author, index) {
    let authorName = author.name;

    // Check if author has a homepage link
    const authorLink = authorLinks[authorName];
    if (authorLink && authorLink !== '') {
      authorName = `<a href="${authorLink}" target="_blank">${authorName}</a>`;
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
  for (const [linkType, url] of Object.entries(pub.links)) {
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
  linkItems.sort(function(a, b) {
    return b.text.length - a.text.length;
  });

  const sidebarLinksHTML = linkItems.map(function(item) {
    const cls = item.isMisc ? 'button misc-button' : 'button';
    const target = item.isMisc ? ' target="_blank"' : '';
    return `<a href="${item.url}" class="${cls}"${target}>${item.text}</a>`;
  }).join('\n            ');

  const authorsParagraphHTML = authorsHTML
    ? `<p class="paper-authors">${authorsHTML}</p>`
    : '';

  const venueNoBreak = pub.venue.replace(/\s/g, '&nbsp;');
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
    ? `<a href="${primaryTitleLink}" class="${titleClass}" target="_blank" rel="noopener noreferrer">${pub.title}</a>`
    : `<span class="${titleClass}">${pub.title}</span>`;

  const highlightsHTML = createHighlightsHTML(pub.highlights);
  const imageHTML = pub.image
    ? `<div class="paper-image">
            <img src='${pub.image}' alt="${pub.id}">
          </div>`
    : '';

  return `
        <div class="paper-container fade-in delay-2${pub.image ? '' : ' paper-container--no-image'}">
          <div class="paper-sidebar">
            <span class="${pub.venueType}"><strong>${venueText}</strong></span>
            ${sidebarLinksHTML}
          </div>
          <div class="paper-main">
            ${titleHTML}
            ${authorsParagraphHTML}
          </div>${imageHTML}${highlightsHTML}
        </div>`;
}

function createHighlightsHTML(highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return '';
  }

  const items = highlights
    .map(function(item) {
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

function createPublicationHTML(pub) {
  if (window.innerWidth <= 600) {
    return createPublicationHTMLMobile(pub);
  }
  return createPublicationHTMLDesktop(pub);
}

// Run when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    renderPublications();
  });
} else {
  // DOM already loaded, run now
  renderPublications();
}
