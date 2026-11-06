'use strict';

/* =====================================================================
   SCRIPT.JS: shows one page at a time, fades sections in, and plays
   the audio you add in index.html. You normally do not need to edit this.
   ===================================================================== */

const pages = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('nav a'));
const nav = document.getElementById('mainNav');
const menuBtn = document.getElementById('menuBtn');
const soundBtn = document.getElementById('soundBtn');
const hoverSfx = document.getElementById('hoverSfx');
const clickSfx = document.getElementById('clickSfx');

let soundOn = false;

/* An audio element only counts if you un-commented a <source> inside it. */
const hasSource = (audio) => Boolean(audio && audio.querySelector('source'));
const pageAudio = (page) =>
  document.querySelectorAll(`.page-audio[data-page="${page.dataset.page}"]`);
function playAudio(audio, restart) {
  if (!soundOn || !hasSource(audio)) return;
  if (restart) audio.currentTime = 0;
  audio.play().catch(() => { /* browser blocked playback until the next click */ });
}

function stopPageAudio() {
  document.querySelectorAll('.page-audio').forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

/* ---------- FADE-IN SECTIONS ---------- */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

/* ---------- PAGE SWITCHING (uses the #/page-name part of the address) ---------- */
function showPage() {
  let name = (location.hash.replace('#/', '') || 'home');
  if (name === 'quiz') name = 'trial';   /* old Quiz links open the Final Class Trial */
  const target = document.getElementById('page-' + name) || document.getElementById('page-home');
  const key = target.dataset.page;

  pages.forEach((page) => page.classList.toggle('active', page === target));

  /* Highlight the matching menu button (lesson pages highlight "Lessons") */
  const section = key.startsWith('lesson-') ? 'lessons' : key.startsWith('member-') ? 'members' : key;
  navLinks.forEach((link) => link.classList.toggle('active', link.dataset.nav === section));

  window.scrollTo(0, 0);
  nav.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');

  target.querySelectorAll('.fade:not(.visible)').forEach((el) => fadeObserver.observe(el));

  /* Music and sound effect for this page */
  pageAudio(target).forEach((audio) => {
  playAudio(audio, true);
});
}

window.addEventListener('hashchange', showPage);

/* ---------- MENU BUTTON (mobile) ---------- */
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

/* ---------- SOUND ON / OFF ---------- */
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
  if (soundOn) {
    const active = document.querySelector('.page.active');
    if (active) pageAudio(active).forEach((audio) => playAudio(audio, false));
  } else {
    stopPageAudio();
  }
});

/* ---------- HOVER AND CLICK SOUND EFFECTS ---------- */
document.querySelectorAll('.card, .btn').forEach((el) => {
  el.addEventListener('mouseenter', () => playAudio(hoverSfx, true));
  el.addEventListener('click', () => playAudio(clickSfx, true));
});

showPage();

/* =====================================================================
   FINAL CLASS TRIAL
   Edit the three numbers below to change the rules.
   ===================================================================== */
(() => {
  const TOTAL_SECONDS = 60;   /* CHANGE THIS: starting time in seconds */
  const DANGER_AT = 15;       /* CHANGE THIS: timer turns red at this many seconds left */
  const PASS_SCORE = 8;       /* CHANGE THIS: correct answers needed to pass */
  const HOME_URL = 'index.html';

  const $ = (id) => document.getElementById(id);
  const intro = $('trialIntro');
  const run = $('trialRun');
  const timerEl = $('trialTimer');
  const progressEl = $('trialProgress');
  const winOverlay = $('winOverlay');
  const guiltyOverlay = $('guiltyOverlay');
  const videoWrap = $('executionWrap');
  const video = $('executionVideo');
  const questions = Array.from(document.querySelectorAll('.q'));
  const sfx = {
    correct: $('sfxCorrect'), wrong: $('sfxWrong'), guilty: $('sfxGuilty'),
    execution: $('sfxExecution'), success: $('sfxSuccess')
  };

  let state = 'idle';   /* idle | running | judging | done */
  let endTime = 0;
  let ticker = null;
  let score = 0;
  let answered = 0;
  let videoPlaying = false;
  const timeouts = [];

  const later = (fn, ms) => timeouts.push(setTimeout(fn, ms));
  const goHome = () => { window.location.href = HOME_URL; };
  const formatTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  /* A sound plays only if you un-commented its <source> in index.html */
  function playSfx(audio) {
    if (!audio || !audio.querySelector('source')) return;
    audio.currentTime = 0;
    audio.play().catch(() => { /* playback blocked by the browser */ });
  }

  function resetTrial() {
    clearInterval(ticker);
    timeouts.splice(0).forEach(clearTimeout);
    state = 'idle'; score = 0; answered = 0; videoPlaying = false;
    questions.forEach((q) => {
      q.classList.remove('locked');
      q.querySelectorAll('.opt').forEach((o) => o.classList.remove('chosen', 'right', 'wrong'));
    });
    timerEl.textContent = formatTime(TOTAL_SECONDS);
    timerEl.classList.remove('danger');
    progressEl.textContent = 'Answered 0 / ' + questions.length;
    intro.hidden = false;
    run.hidden = true;
    [winOverlay, guiltyOverlay].forEach((o) => { o.hidden = true; o.classList.remove('show'); });
    video.pause();
    videoWrap.hidden = true;
    Object.values(sfx).forEach((a) => { a.pause(); });
  }

  function startTrial() {
    resetTrial();
    state = 'running';
    intro.hidden = true;
    run.hidden = false;
    window.scrollTo(0, 0);
    endTime = Date.now() + TOTAL_SECONDS * 1000;
    ticker = setInterval(updateTimer, 200);
    updateTimer();
  }

  function updateTimer() {
    if (state !== 'running') return;
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    timerEl.textContent = formatTime(left);
    timerEl.classList.toggle('danger', left <= DANGER_AT);
    if (left === 0) finishTrial(false);
  }

  function chooseAnswer(opt) {
    const q = opt.closest('.q');
    if (state !== 'running' || q.classList.contains('locked')) return;
    const right = opt.dataset.letter === q.dataset.correct;
    q.classList.add('locked');
    opt.classList.add('chosen', right ? 'right' : 'wrong');
    playSfx(right ? sfx.correct : sfx.wrong);
    if (right) score += 1;
    answered += 1;
    progressEl.textContent = 'Answered ' + answered + ' / ' + questions.length;
    if (answered === questions.length) {
      state = 'judging';
      clearInterval(ticker);
      later(() => finishTrial(score >= PASS_SCORE), 800);
    }
  }

   function finishTrial(passed) {
    if (state === 'done') return;
    state = 'done';
    clearInterval(ticker);
    stopMusic();   /* time is up or every question is answered: the main music stops */
    passed ? showWin() : showGuilty();
  }

  /* Stops the page music only (home and lesson music). Answer and verdict sounds are not affected. */
  function stopMusic() {
    document.querySelectorAll('.page-audio').forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /* ---------- PASS: YOU ARE FREE, then redirect after 5 seconds ---------- */
  function showWin() {
    winOverlay.hidden = false;
    void winOverlay.offsetWidth;
    winOverlay.classList.add('show');
    playSfx(sfx.success);
    later(goHome, 5000);
  }

  /* ---------- FAIL: VERDICT GUILTY, red flash, execution video after 2 seconds ---------- */
  function showGuilty() {
    guiltyOverlay.hidden = false;
    void guiltyOverlay.offsetWidth;
    guiltyOverlay.classList.add('show');
    playSfx(sfx.guilty);
    later(playExecution, 2000);
  }

  function playExecution() {
    videoWrap.hidden = false;
    playSfx(sfx.execution);
    if (videoWrap.requestFullscreen) videoWrap.requestFullscreen().catch(() => {});
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;               /* retry silently if the browser blocks sound */
      video.play().catch(videoFailed);
    });
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) videoFailed();   /* file missing */
    later(() => { if (!videoPlaying) videoFailed(); }, 15000);   /* video missing or stuck */
  }

  /* If the video cannot play, say why on screen, then return to the home page */
  function videoFailed() {
    if (videoPlaying || state !== 'done') return;
    $('videoError').hidden = false;
    later(goHome, 7000);
  }

  video.addEventListener('playing', () => { videoPlaying = true; });
  video.addEventListener('ended', goHome);
  video.addEventListener('error', videoFailed);
  const videoSource = video.querySelector('source');
  if (videoSource) videoSource.addEventListener('error', videoFailed);

  /* Unskippable: resume if paused, and block right-click and keyboard shortcuts while it plays */
  video.addEventListener('pause', () => {
    if (!video.ended && !videoWrap.hidden) video.play().catch(() => {});
  });
  document.addEventListener('contextmenu', (e) => { if (!videoWrap.hidden) e.preventDefault(); });
  document.addEventListener('keydown', (e) => { if (!videoWrap.hidden) e.preventDefault(); });

  $('trialStart').addEventListener('click', startTrial);
  run.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (opt) chooseAnswer(opt);
  });

  /* Leaving the page cancels the trial so it always restarts from the Begin screen */
  window.addEventListener('hashchange', resetTrial);
  resetTrial();
})();

(() => {
  const slider = document.getElementById('volume');
  const applyVolume = () => {
    const level = Number(slider.value) / 100;
    document.querySelectorAll('audio, video').forEach((media) => { media.volume = level; });
  };
  slider.addEventListener('input', applyVolume);
  applyVolume();
})();
