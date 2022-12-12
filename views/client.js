// Main thread

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  
  const publicVapidKey = 'BJOcvM1pcVl85NjYdxHEIjJA8IAWG7RHPS6zEwVN8mdw7X0rUQN08CW10NGpIaRYQ7aPh3BGu0iVqa8I2F_1MqA';
    
  async function checkNotifications() {
    if ('serviceWorker' in navigator) {
      const register = await navigator.serviceWorker.register('worker.js', {
        scope: '/'
      });
  
      console.log('waiting for acceptance');
      const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
      console.log('acceptance complete');
  
      await fetch('http://localhost:4000/test', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      console.error('Service workers are not supported in this browser');
    }
  }
  setInterval( checkNotifications, 30000);
  
