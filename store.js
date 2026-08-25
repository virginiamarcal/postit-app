const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COLORS = ['#FFE066', '#C8E6C9', '#F8BBD0', '#B3E5FC', '#FFCCBC', '#D1C4E9'];

class Store {
  constructor(userDataPath) {
    this.file = path.join(userDataPath, 'tasks.json');
    this.data = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf-8');
      const parsed = JSON.parse(raw);
      return { tasks: parsed.tasks || [], settings: parsed.settings || {} };
    } catch {
      return { tasks: [], settings: {} };
    }
  }

  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getTasks() {
    return this.data.tasks;
  }

  getTodayTasks(todayStr) {
    return this.data.tasks
      .filter((t) => t.date === todayStr && !t.done)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }

  getUpcomingTasks(todayStr) {
    return this.data.tasks
      .filter((t) => !t.done && t.date >= todayStr)
      .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
  }

  addTask({ text, date, time }) {
    const task = {
      id: crypto.randomUUID(),
      text: text.trim(),
      date,
      time: time || null,
      done: false,
      notified: false,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.round((Math.random() - 0.5) * 12),
      x: null,
      y: null,
      createdAt: Date.now(),
    };
    this.data.tasks.push(task);
    this._save();
    return task;
  }

  updateTask(id, patch) {
    const t = this.data.tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    this._save();
    return t;
  }

  deleteTask(id) {
    this.data.tasks = this.data.tasks.filter((x) => x.id !== id);
    this._save();
  }

  hasPendingToday(todayStr) {
    return this.data.tasks.some((t) => t.date === todayStr && !t.done);
  }

  getDueForToast(todayStr, nowHM) {
    return this.data.tasks.filter(
      (t) => !t.done && !t.notified && t.date === todayStr && t.time && t.time <= nowHM
    );
  }

  getSetting(key, fallback) {
    return key in this.data.settings ? this.data.settings[key] : fallback;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this._save();
  }
}

module.exports = { Store, COLORS };
