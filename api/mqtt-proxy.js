const mqtt = require('mqtt');

// Global MQTT client to maintain connection
let mqttClient = null;
let isConnecting = false;

function connectToMqtt() {
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  if (isConnecting) {
    return null;
  }

  isConnecting = true;
  
  try {
    mqttClient = mqtt.connect('ws://89.24.76.191:9001', {
      clientId: `proxy-${Math.random().toString(16).substring(2, 8)}`,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 60
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Proxy: Connected to broker');
      isConnecting = false;
      
      // Subscribe to status topics
      mqttClient.subscribe(['IoT/Brana/Status', 'IoT/Brana/Status2'], (err) => {
        if (err) {
          console.error('MQTT Proxy: Subscribe error:', err);
        } else {
          console.log('MQTT Proxy: Subscribed to status topics');
        }
      });
    });

    mqttClient.on('error', (error) => {
      console.error('MQTT Proxy: Connection error:', error);
      isConnecting = false;
    });

    mqttClient.on('close', () => {
      console.log('MQTT Proxy: Connection closed');
      isConnecting = false;
    });

  } catch (error) {
    console.error('MQTT Proxy: Setup error:', error);
    isConnecting = false;
  }

  return mqttClient;
}

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('MQTT Proxy: Request received', req.method, req.url);

  const client = connectToMqtt();

  if (req.method === 'POST') {
    // Handle MQTT publish commands
    const { topic, message } = req.body;
    
    if (!client || !client.connected) {
      res.status(503).json({ error: 'MQTT not connected' });
      return;
    }

    client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error('MQTT Proxy: Publish error:', err);
        res.status(500).json({ error: 'Publish failed', details: err.message });
      } else {
        console.log(`MQTT Proxy: Published to ${topic}: ${message}`);
        res.status(200).json({ success: true, topic, message });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    // Return current status
    if (!client) {
      res.status(503).json({ 
        connected: false, 
        error: 'MQTT client not initialized' 
      });
      return;
    }

    res.status(200).json({ 
      connected: client.connected,
      status: 'MQTT Proxy Active via HTTP',
      clientId: client.options?.clientId
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}