/**
 * Card System - Manages collectible cards that grant abilities/powers
 */

export type CardType = 
  | 'boost'           // Speed boost
  | 'shield'          // Invulnerability shield
  | 'magnet'          // Attracts nearby coins
  | 'turbo'           // Turbo burst
  | 'ice'             // Slippery surface effect
  | 'shield_buster'   // Removes opponent shields
  | 'coin_magnet'     // Extended coin magnet
  | 'ninja'           // Ghost mode (pass through obstacles)
  | 'super_jump'      // Extra high jump
  | 'time_freeze';    // Slows time briefly

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
  icon: string;
  duration?: number;       // For time-based effects (seconds)
  cooldown?: number;       // Cooldown after use (seconds)
}

export interface DeckState {
  hand: Card[];
  drawPile: Card[];
  discardPile: Card[];
  currentCardIndex: number;
  maxHandSize: number;
}

export class CardDeck {
  private allCards: Map<CardType, Card[]>;
  private deckState: DeckState;
  private currentActiveCard: Card | null = null;
  private activeEffectEnd: number = 0;
  
  constructor() {
    this.allCards = new Map();
    this.initializeCards();
    
    this.deckState = {
      hand: [],
      drawPile: [],
      discardPile: [],
      currentCardIndex: 0,
      maxHandSize: 5
    };
    
    this.buildDeck();
  }

  /** Initialize all available cards */
  private initializeCards(): void {
    const cards: Record<CardType, Omit<Card, 'id'>[]> = {
      boost: [
        { type: 'boost', name: 'Speed Boost', description: '+50% speed for 3 seconds', rarity: 'common', color: '#ff6b35', icon: '⚡' },
        { type: 'boost', name: 'Turbo Charge', description: '+100% speed for 2 seconds', rarity: 'rare', color: '#ff9f43', icon: '🔥' },
        { type: 'boost', name: 'Mach Speed', description: '+150% speed for 1 second', rarity: 'epic', color: '#ee5a24', icon: '💨' },
      ],
      shield: [
        { type: 'shield', name: 'Basic Shield', description: 'Invulnerable for 3 seconds', rarity: 'common', color: '#54a0ff', icon: '🛡️' },
        { type: 'shield', name: 'Titan Shield', description: 'Invulnerable for 5 seconds', rarity: 'rare', color: '#74b9ff', icon: '⭕' },
      ],
      magnet: [
        { type: 'magnet', name: 'Coin Magnet', description: 'Attract coins within 200px for 5 seconds', rarity: 'common', color: '#00d2d3', icon: '🧲' },
        { type: 'coin_magnet', name: 'Super Magnet', description: 'Attract coins within 400px for 8 seconds', rarity: 'rare', color: '#0984e3', icon: '🌟' },
      ],
      turbo: [
        { type: 'turbo', name: 'Nitro Burst', description: +50 speed instant boost', rarity: 'common', color: '#fd79a8', icon: '🚀' },
        { type: 'turbo', name: 'Afterburner', description: 'Sustained speed boost for 4 seconds', rarity: 'rare', color: '#e84393', icon: '💫' },
      ],
      ice: [
        { type: 'ice', name: 'Ice Slide', description: 'Slippery surface for drifting bonus', rarity: 'common', color: '#7ed6df', icon: '❄️' },
      ],
      shield_buster: [
        { type: 'shield_buster', name: 'Shield Breaker', description: 'Destroy target shield instantly', rarity: 'rare', color: '#d63031', icon: '💥' },
      ],
      ninja: [
        { type: 'ninja', name: 'Ghost Mode', description: 'Pass through obstacles for 4 seconds', rarity: 'epic', color: '#6c5ce7', icon: '👻' },
      ],
      super_jump: [
        { type: 'super_jump', name: 'Super Jump', description: 'Jump 3x normal height', rarity: 'common', color: '#00b894', icon: '🦘' },
      ],
      time_freeze: [
        { type: 'time_freeze', name: 'Time Slow', description: 'Slow time by 50% for 3 seconds', rarity: 'legendary', color: '#ffeaa7', icon: '⏱️' },
      ],
    };

    let idCounter = 0;
    for (const [type, cardTemplates] of Object.entries(cards)) {
      this.allCards.set(type as CardType, cardTemplates.map(template => ({
        ...template,
        id: `card_${++idCounter}`
      })));
    }
  }

  /** Build the initial deck */
  private buildDeck(): void {
    const allCards: Card[] = [];
    
    for (const cards of this.allCards.values()) {
      allCards.push(...cards);
    }

    // Shuffle the deck
    this.shuffle(allCards);

    // Fill draw pile
    this.deckState.drawPile = [...allCards];
    
    // Draw initial hand
    this.drawCards(this.deckState.maxHandSize);
  }

  /** Fisher-Yates shuffle */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /** Draw cards into hand */
  public drawCards(count: number): number {
    let drawn = 0;
    
    // If draw pile empty, recycle discard pile
    if (this.deckState.drawPile.length === 0 && this.deckState.discardPile.length > 0) {
      this.deckState.drawPile = [...this.deckState.discardPile];
      this.deckState.discardPile = [];
      this.shuffle(this.deckState.drawPile);
    }

    // Draw up to count cards
    while (drawn < count && this.deckState.drawPile.length > 0 && this.deckState.hand.length < this.deckState.maxHandSize) {
      const card = this.deckState.drawPile.pop()!;
      this.deckState.hand.push(card);
      drawn++;
    }

    return drawn;
  }

  /** Play a card from hand */
  public playCard(index: number): Card | null {
    if (index < 0 || index >= this.deckState.hand.length) return null;
    if (this.currentActiveCard !== null) return null; // Only one card active at a time

    const card = this.deckState.hand[index];
    this.deckState.hand.splice(index, 1);
    this.deckState.discardPile.push(card);
    
    this.activateCard(card);
    
    return card;
  }

  /** Activate a card's effect */
  public activateCard(card: Card): void {
    this.currentActiveCard = card;
    this.activeEffectEnd = performance.now() + (card.duration ? card.duration * 1000 : 0);

    // Dispatch custom event for card activation
    window.dispatchEvent(new CustomEvent('card-activated', { detail: card }));
  }

  /** Check if active card effect has ended */
  public updateActiveCard(deltaTime: number): boolean {
    if (!this.currentActiveCard) return false;

    const now = performance.now();
    const elapsed = now - this.activeEffectEnd;

    if (elapsed >= 0) {
      // Effect expired
      this.deactivateCurrentCard();
      return true; // Card expired
    }

    return false; // Still active
  }

  /** Deactivate current card */
  public deactivateCurrentCard(): void {
    if (this.currentActiveCard) {
      window.dispatchEvent(new CustomEvent('card-deactivated', { detail: this.currentActiveCard }));
      this.currentActiveCard = null;
    }
  }

  /** Get cards in hand */
  public getHand(): Card[] {
    return [...this.deckState.hand];
  }

  /** Get currently active card */
  public getActiveCard(): Card | null {
    return this.currentActiveCard;
  }

  /** Get deck statistics */
  public getStats(): { hand: number; draw: number; discard: number } {
    return {
      hand: this.deckState.hand.length,
      draw: this.deckState.drawPile.length,
      discard: this.deckState.discardPile.length
    };
  }

  /** Reshuffle discard pile into draw pile */
  public reshuffleDiscard(): void {
    if (this.deckState.discardPile.length > 0) {
      this.deckState.drawPile = [...this.deckState.discardPile];
      this.deckState.discardPile = [];
      this.shuffle(this.deckState.drawPile);
    }
  }

  /** Reset deck to initial state */
  public reset(): void {
    this.deckState.hand = [];
    this.deckState.drawPile = [];
    this.deckState.discardPile = [];
    this.deckState.currentCardIndex = 0;
    this.currentActiveCard = null;
    this.buildDeck();
  }

  /** Get a random card of specific type */
  public getRandomCard(type: CardType): Card | null {
    const cards = this.allCards.get(type);
    if (!cards || cards.length === 0) return null;
    
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    return { ...randomCard, id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
  }
}