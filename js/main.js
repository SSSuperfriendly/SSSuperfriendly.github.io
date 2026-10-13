// Site JavaScript: sticky nav + smooth scrolling.
// Nav links are written as /#Anchor so they work from any subpage:
// if the anchor exists on the current page we scroll to it, otherwise we
// navigate to the homepage and let the browser land on the anchor.
//
// Research rendering lives in publications.js (SitePublications) so the
// build can write the default list into the page; this file only enhances
// filtering, transitions and viewport re-rendering.

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

function isPlainLeftClick(event) {
  // Let the browser keep its own conventions: Cmd/Ctrl/Shift/middle click
  // mean "open in a new tab / window", so those must not be intercepted.
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !event.defaultPrevented;
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
      if (!isPlainLeftClick(event)) {
        return;
      }
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
// Research section: the default "Favorite" list is already in the HTML
// (written at build time), so a missing script or a failed request cannot
// empty the section. This block fetches the data to power the topic
// filters and the mobile/desktop switch.
// ================================================================

let authorLinks = {};
let allPublications = [];
let currentPublicationLayoutMode = 'desktop';
let researchResizeRafId = null;
let researchTransitionTimer = null;
let placeholderTitleTimer = null;
let activePlaceholderTitle = null;

const placeholderTitleIdeas = [
  'High-Performance AI',
  'AI Systems',
  'AI for Science',
  'AI for Sustainability'
];

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

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(url + ' → HTTP ' + response.status);
  }
  return response.json();
}

// Author links are a pure enhancement: if they fail to load the names simply
// render without links, so a failure here never takes the list down.
async function loadAuthorLinks() {
  try {
    authorLinks = await fetchJSON('/data/authors.json');
  } catch (error) {
    authorLinks = {};
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

function renderPublicationList(publications, filter) {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }

  stopPlaceholderTitleCycle(false);
  clearResearchStatus();
  const render = window.SitePublications;
  const mode = getPublicationLayoutMode();

  // First paint: the build already wrote this exact list into the page. Adopt
  // those nodes instead of re-rendering them, so the entrance animation does
  // not play twice and the section never blanks out between paints.
  const wrapper = filter === 'selected'
    ? container.querySelector('.research-static--' + (mode === 'mobile' ? 'mobile' : 'desktop'))
    : null;
  if (wrapper && render) {
    const nodes = Array.from(wrapper.childNodes);
    container.replaceChildren(...nodes);
    initPlaceholderTitleEffects(container);
    return;
  }

  container.innerHTML = render
    ? render.renderPublications(publications, authorLinks, mode)
    : '';
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
  // The typing effect is decoration only — with reduced motion requested the
  // title is left as the complete static string instead of being animated.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

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

// Accessible load-failure notice. It is added above the (unchanged) list, so
// the publications that were already in the page stay readable.
function clearResearchStatus() {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }
  const status = container.querySelector('.research-status');
  if (status) {
    status.remove();
  }
}

function showResearchError(message) {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }
  clearResearchStatus();

  const status = document.createElement('div');
  status.className = 'research-status';
  status.setAttribute('role', 'status');

  const text = document.createElement('p');
  text.className = 'research-status__text';
  text.textContent = message;
  status.appendChild(text);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'button research-status__retry';
  retry.textContent = 'Retry';
  retry.addEventListener('click', function() {
    loadResearchData();
  });
  status.appendChild(retry);

  container.prepend(status);
}

function updateResearchContent(normalized, filteredPublications) {
  const container = document.getElementById('publications-container');
  renderPublicationList(filteredPublications, normalized);

  if (container) {
    void container.offsetWidth;
    container.classList.remove('is-leaving');
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

  if (researchTransitionTimer !== null) {
    clearTimeout(researchTransitionTimer);
    researchTransitionTimer = null;
  }

  if (!shouldFadeOut) {
    updateResearchContent(normalized, filteredPublications);
    return;
  }

  container.classList.add('is-leaving');

  researchTransitionTimer = setTimeout(function() {
    researchTransitionTimer = null;
    updateResearchContent(normalized, filteredPublications);
  }, 160);
}

function initResearchFilter() {
  // Always default to Favorite ("selected") on every page load / refresh —
  // the last-selected filter is intentionally NOT remembered.
  const defaultFilter = 'selected';

  document.querySelectorAll('.research-filter__btn').forEach(function(button) {
    button.disabled = false;
    button.addEventListener('click', function() {
      setResearchFilter(button.dataset.filter);
    });
  });

  currentPublicationLayoutMode = getPublicationLayoutMode();
  window.addEventListener('resize', handleResearchResize);

  setResearchFilter(defaultFilter, true);
}

// Load the data behind the topic filters. The page already shows the default
// list, so this only ever upgrades it; on failure the built-in list stays and
// an accessible retry notice is shown.
async function loadResearchData() {
  const container = document.getElementById('publications-container');
  if (!container) {
    return;
  }

  try {
    const results = await Promise.all([
      loadAuthorLinks(),
      fetchJSON('/data/publications.json'),
    ]);
    allPublications = results[1];
    initResearchFilter();
  } catch (error) {
    console.error('Error loading publications:', error);
    allPublications = [];
    showResearchError('Could not load the publication list.');
    document.querySelectorAll('.research-filter__btn').forEach(function(button) {
      button.disabled = true;
    });
  }
}

// Run when DOM is loaded — but only on pages that actually have the module.
if (document.getElementById('publications-container')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadResearchData);
  } else {
    loadResearchData();
  }
}
