/**
 * Test Setup Configuration
 * Globální nastavení pro všechny testy
 */

import '@testing-library/jest-dom';

// Mock IntersectionObserver pro komponenty
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.alert
global.alert = jest.fn();

// Mock window.confirm
global.confirm = jest.fn();

// Mock window.prompt
global.prompt = jest.fn();

// Mock console methods pro čistší test výstup
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock Firebase environment variables
process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.REACT_APP_FIREBASE_APP_ID = '1:123456789:web:abcdef123456';
process.env.REACT_APP_FIREBASE_MEASUREMENT_ID = 'G-ABCDEF1234';

// Setup fetch mock
global.fetch = jest.fn();

// Mock lokální storage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock session storage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};
global.navigator.geolocation = mockGeolocation;

// Mock Date.now pro konzistentní testování
const mockDateNow = jest.spyOn(Date, 'now');
const MOCK_DATE = new Date('2024-12-01T10:00:00.000Z');
mockDateNow.mockReturnValue(MOCK_DATE.getTime());

// Cleanup funkce po každém testu
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Error handling setup
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};

console.log('🧪 Test Setup: Initialized successfully');