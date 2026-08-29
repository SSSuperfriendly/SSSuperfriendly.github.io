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
      var target = hash ? document.querySelector(hash) : null;

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
