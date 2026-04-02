import type * as vscode from "vscode";

export interface SavedSubscription {
  name: string;
  subject: string;
}

export interface SavedTemplate {
  name: string;
  subject: string;
  payload: string;
  headers: Record<string, string>;
}

export interface MessageBookmark {
  name: string;
  stream: string;
  sequence: number;
  subject: string;
}

interface BookmarksData {
  subscriptions: SavedSubscription[];
  templates: SavedTemplate[];
  messageBookmarks: MessageBookmark[];
}

const BOOKMARKS_KEY = "leafnode.bookmarks";

export class BookmarksService {
  constructor(private globalState: vscode.Memento) {}

  // Subscriptions
  getSavedSubscriptions(): SavedSubscription[] {
    return this.getData().subscriptions;
  }

  async saveSubscription(sub: SavedSubscription): Promise<void> {
    const data = this.getData();
    data.subscriptions = [
      ...data.subscriptions.filter((s) => s.name !== sub.name),
      sub,
    ];
    await this.setData(data);
  }

  async deleteSubscription(name: string): Promise<void> {
    const data = this.getData();
    data.subscriptions = data.subscriptions.filter((s) => s.name !== name);
    await this.setData(data);
  }

  // Templates
  getSavedTemplates(): SavedTemplate[] {
    return this.getData().templates;
  }

  async saveTemplate(template: SavedTemplate): Promise<void> {
    const data = this.getData();
    data.templates = [
      ...data.templates.filter((t) => t.name !== template.name),
      template,
    ];
    await this.setData(data);
  }

  async deleteTemplate(name: string): Promise<void> {
    const data = this.getData();
    data.templates = data.templates.filter((t) => t.name !== name);
    await this.setData(data);
  }

  // Message bookmarks
  getMessageBookmarks(): MessageBookmark[] {
    return this.getData().messageBookmarks;
  }

  async saveMessageBookmark(bookmark: MessageBookmark): Promise<void> {
    const data = this.getData();
    data.messageBookmarks = [
      ...data.messageBookmarks.filter((b) => b.name !== bookmark.name),
      bookmark,
    ];
    await this.setData(data);
  }

  async deleteMessageBookmark(name: string): Promise<void> {
    const data = this.getData();
    data.messageBookmarks = data.messageBookmarks.filter(
      (b) => b.name !== name,
    );
    await this.setData(data);
  }

  // Private helpers
  private getData(): BookmarksData {
    return this.globalState.get<BookmarksData>(BOOKMARKS_KEY, {
      subscriptions: [],
      templates: [],
      messageBookmarks: [],
    });
  }

  private async setData(data: BookmarksData): Promise<void> {
    await this.globalState.update(BOOKMARKS_KEY, data);
  }
}
