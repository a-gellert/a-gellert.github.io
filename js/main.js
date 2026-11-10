/**
 * Tiny Heart Studios — interface motion & interactions.
 * Keeps the site usable without JavaScript: all enhancements are additive.
 */
(function () {
    'use strict';

    const root = document.documentElement;
    root.classList.add('js');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       Scroll progress
       ------------------------------------------------------------------ */
    function initScrollProgress() {
        let progress = document.querySelector('.scroll-progress');
        if (!progress) {
            progress = document.createElement('div');
            progress.className = 'scroll-progress';
            progress.innerHTML = '<div class="scroll-progress__bar"></div>';
            document.body.prepend(progress);
        }
        const bar = progress.querySelector('.scroll-progress__bar');
        if (!bar) return;

        let ticking = false;
        const update = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
            bar.style.width = `${(ratio * 100).toFixed(2)}%`;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    /* ------------------------------------------------------------------
       Sticky nav state + mobile menu
       ------------------------------------------------------------------ */
    function initNav() {
        const nav = document.querySelector('.top-nav');
        const menuBtn = document.querySelector('.nav-menu-btn');
        const links = document.querySelector('.nav-links');

        if (nav) {
            const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }

        if (!menuBtn || !links) return;

        const close = () => {
            links.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
        };

        menuBtn.addEventListener('click', () => {
            const open = !links.classList.contains('open');
            links.classList.toggle('open', open);
            menuBtn.setAttribute('aria-expanded', String(open));
        });

        links.addEventListener('click', (event) => {
            if (event.target.closest('a')) close();
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.top-nav')) close();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) close();
        });
    }

    /* ------------------------------------------------------------------
       Section-aware navigation
       ------------------------------------------------------------------ */
    function initSectionNav() {
        const links = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
        if (!links.length || !('IntersectionObserver' in window)) return;

        const sections = links
            .map((link) => {
                const id = link.getAttribute('href').slice(1);
                const section = id ? document.getElementById(id) : null;
                return section ? { link, section } : null;
            })
            .filter(Boolean);

        if (!sections.length) return;

        const setActive = (activeLink) => {
            links.forEach((link) => link.classList.toggle('active', link === activeLink));
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const match = sections.find((item) => item.section === entry.target);
                if (match) setActive(match.link);
            });
        }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });

        sections.forEach(({ section }) => observer.observe(section));
    }

    /* ------------------------------------------------------------------
       Reveal on scroll
       ------------------------------------------------------------------ */
    function initReveals() {
        const targets = Array.from(document.querySelectorAll('[data-reveal]'));
        if (!targets.length) return;

        if (prefersReducedMotion || !('IntersectionObserver' in window)) {
            targets.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            rootMargin: '0px 0px -8% 0px',
            threshold: 0.08
        });

        targets.forEach((el, index) => {
            if (!el.style.getPropertyValue('--reveal-delay')) {
                el.style.setProperty('--reveal-delay', `${Math.min(index * 45, 360)}ms`);
            }
            observer.observe(el);
        });

        // Fallback for hidden tabs, reduced rendering or an observer that never
        // reports: reveal everything already inside the viewport.
        const revealInView = () => {
            targets.forEach((el) => {
                if (el.classList.contains('is-visible')) return;
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    el.classList.add('is-visible');
                    observer.unobserve(el);
                }
            });
        };

        // Above-the-fold content should never wait for a timer or observer.
        revealInView();

        setTimeout(revealInView, 600);
        window.addEventListener('scroll', revealInView, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) revealInView();
        });
    }

    /* ------------------------------------------------------------------
       Cursor spotlight on cards
       ------------------------------------------------------------------ */
    function initCardSpotlight() {
        if (prefersReducedMotion) return;
        const cards = Array.from(document.querySelectorAll('.card'));
        if (!cards.length) return;

        cards.forEach((card) => {
            let frame = 0;
            card.addEventListener('pointermove', (event) => {
                if (frame) return;
                frame = requestAnimationFrame(() => {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
                    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
                    frame = 0;
                });
            }, { passive: true });
        });
    }

    /* ------------------------------------------------------------------
       Animated counters
       ------------------------------------------------------------------ */
    function initCounters() {
        const counters = Array.from(document.querySelectorAll('[data-count]'));
        if (!counters.length) return;

        const animate = (el) => {
            const target = Number(el.dataset.count);
            if (!Number.isFinite(target)) return;
            if (prefersReducedMotion) {
                el.textContent = String(target);
                return;
            }
            const duration = 1100;
            const start = performance.now();
            const suffix = el.dataset.suffix || '';
            const prefix = el.dataset.prefix || '';

            const tick = (now) => {
                const progress = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
                if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };

        if (!('IntersectionObserver' in window)) {
            counters.forEach(animate);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                animate(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.4 });

        counters.forEach((el) => observer.observe(el));
    }

    /* ------------------------------------------------------------------
       Article modal reading progress
       ------------------------------------------------------------------ */
    function initReadingProgress() {
        const modal = document.getElementById('article-modal');
        const content = modal?.querySelector('.modal-content');
        if (!modal || !content) return;

        let bar = modal.querySelector('.modal-progress__bar');
        if (!bar) {
            const wrapper = document.createElement('div');
            wrapper.className = 'modal-progress';
            wrapper.innerHTML = '<div class="modal-progress__bar"></div>';
            content.prepend(wrapper);
            bar = wrapper.querySelector('.modal-progress__bar');
        }
        if (!bar) return;

        const update = () => {
            const scrollable = content.scrollHeight - content.clientHeight;
            const ratio = scrollable > 0 ? Math.min(1, Math.max(0, content.scrollTop / scrollable)) : 0;
            bar.style.width = `${(ratio * 100).toFixed(2)}%`;
        };

        content.addEventListener('scroll', update, { passive: true });

        const observer = new MutationObserver(() => {
            content.scrollTop = 0;
            update();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        update();
    }

    /* ------------------------------------------------------------------
       Boot
       ------------------------------------------------------------------ */
    function boot() {
        window.__UI_MOTION_BOOTED__ = true;
        initScrollProgress();
        initNav();
        initSectionNav();
        initReveals();
        initCardSpotlight();
        initCounters();
        initReadingProgress();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
