import { describe, expect, it } from 'vitest';
import { createComposerDraftRepository } from '../composer-draft-repository';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('composerDraftRepository', () => {
  it('returns an empty string when no draft is saved', () => {
    const repository = createComposerDraftRepository(new MemoryStorage());

    expect(repository.get()).toBe('');
  });

  it('saves and reads back a draft', () => {
    const repository = createComposerDraftRepository(new MemoryStorage());

    repository.save('对接订单接口');

    expect(repository.get()).toBe('对接订单接口');
  });

  it('treats a whitespace-only draft as no draft', () => {
    const storage = new MemoryStorage();
    const repository = createComposerDraftRepository(storage);

    repository.save('first');
    repository.save('   ');

    expect(repository.get()).toBe('');
  });

  it('clears the draft', () => {
    const repository = createComposerDraftRepository(new MemoryStorage());

    repository.save('draft note');
    repository.clear();

    expect(repository.get()).toBe('');
  });
});
