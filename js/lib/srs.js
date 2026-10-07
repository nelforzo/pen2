/**
 * Minimal SRS scheduler (SM-2 inspired).
 * Supports maturity-based fade-out progression.
 */

const DAY_MS = 86400_000;
const MINUTE_MS = 60_000;

export const STATE = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
};

export const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

export function createCard(char) {
  return {
    id: char,
    state: STATE.NEW,
    step: 0,
    interval: 0, // days for review, minutes for learning
    ef: 2.5,
    due: Date.now(),
    reps: 0,
    lapses: 0,
    totalReviews: 0,
    strokesAttempted: 0,
    strokesCorrect: 0,
    lastReview: null,
  };
}

export function getMaturity(card) {
  if (card.state === STATE.NEW || card.state === STATE.LEARNING) return 'trace';
  if (card.state === STATE.RELEARNING) return 'guided';
  if (card.state === STATE.REVIEW) {
    return card.interval < 21 ? 'guided' : 'recall';
  }
  return 'trace';
}

export function getModeLabel(mode) {
  const labels = {
    trace: 'Trace',
    guided: 'Guided',
    recall: 'Recall',
  };
  return labels[mode] || 'Trace';
}

export function schedule(card, rating) {
  const now = Date.now();
  card.lastReview = now;
  card.totalReviews++;

  if (card.state === STATE.NEW) {
    card.state = STATE.LEARNING;
    card.step = 0;
  }

  if (card.state === STATE.LEARNING || card.state === STATE.RELEARNING) {
    handleLearning(card, rating, now);
  } else if (card.state === STATE.REVIEW) {
    handleReview(card, rating, now);
  }

  return card;
}

function handleLearning(card, rating, now) {
  if (rating === RATING.AGAIN) {
    card.step = 0;
    card.due = now + MINUTE_MS; // 1 minute
  } else if (rating === RATING.HARD) {
    card.due = now + 10 * MINUTE_MS; // 10 minutes
    card.step++;
  } else {
    // Good or Easy
    card.step++;
    if (card.step >= 2) {
      card.state = STATE.REVIEW;
      card.interval = rating === RATING.EASY ? 2 : 1;
      card.due = now + card.interval * DAY_MS;
      card.reps++;
    } else {
      card.due = now + 10 * MINUTE_MS;
    }
  }
}

function handleReview(card, rating, now) {
  if (rating === RATING.AGAIN) {
    card.lapses++;
    card.state = STATE.RELEARNING;
    card.step = 0;
    card.interval = 0;
    card.due = now + MINUTE_MS;
  } else {
    card.reps++;
    let mult;
    if (rating === RATING.HARD) mult = 1.2;
    else if (rating === RATING.GOOD) mult = card.ef;
    else mult = card.ef * 1.3;

    card.interval = Math.max(1, Math.round((card.interval || 1) * mult));
    card.due = now + card.interval * DAY_MS;

    // Update EF (SM-2 formula, simplified)
    const q = rating === RATING.HARD ? 3 : rating === RATING.GOOD ? 4 : 5;
    card.ef = Math.max(1.3, card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
}

export function isDue(card) {
  return card.due <= Date.now();
}

export function suggestRating(card, sessionStats) {
  // sessionStats: { totalStrokes, retries, hints }
  const { totalStrokes, retries, hints } = sessionStats;
  if (totalStrokes === 0) return RATING.AGAIN;
  const ratio = retries / totalStrokes;
  if (ratio === 0 && !hints) return RATING.EASY;
  if (ratio <= 0.3 && !hints) return RATING.GOOD;
  if (ratio <= 0.6) return RATING.HARD;
  return RATING.AGAIN;
}
