class BrowserNotificationService {
  private audioContext: AudioContext | null = null;
  private faviconUrl: string = '/фавикон_agencycore.png';

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  async show(title: string, body: string, options?: NotificationOptions): Promise<void> {
    const permission = await this.requestPermission();

    if (permission !== 'granted') {
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: this.faviconUrl,
      badge: this.faviconUrl,
      tag: 'agency-erp-notification',
      requireInteraction: false,
      silent: false,
      ...options
    });

    this.playNotificationSound();

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  private playNotificationSound(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }
}

export const browserNotificationService = new BrowserNotificationService();
