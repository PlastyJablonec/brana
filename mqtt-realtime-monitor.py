#!/usr/bin/env python3
"""
MQTT Real-time Monitor - Monitors MQTT connections and messages in real-time
Helps identify when React app attempts connections and what goes wrong
"""

import paho.mqtt.client as mqtt
import json
import time
import threading
from datetime import datetime

class MqttRealTimeMonitor:
    def __init__(self):
        self.message_count = 0
        self.monitoring = True
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] {level}: {message}")
        
    def monitor_mqtt_messages(self):
        """Monitor all MQTT messages on broker"""
        self.log("📡 Starting MQTT message monitor...")
        
        client = mqtt.Client("mqtt-monitor-listener")
        
        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                self.log("✅ Monitor connected to MQTT broker")
                # Subscribe to all topics
                client.subscribe("#", qos=1)
                client.subscribe("$SYS/broker/clients/connected", qos=1)
                client.subscribe("$SYS/broker/clients/disconnected", qos=1)
            else:
                self.log(f"❌ Monitor connection failed (rc={rc})")
                
        def on_message(client, userdata, msg):
            self.message_count += 1
            topic = msg.topic
            payload = msg.payload.decode('utf-8', errors='ignore')
            
            # Highlight connection/disconnection events
            if "connect" in topic.lower() or "disconnect" in topic.lower():
                self.log(f"🔔 CONNECTION EVENT: {topic} = {payload}", "WARN")
            elif topic.startswith("IoT/Brana/"):
                self.log(f"🚪 GATE MESSAGE: {topic} = {payload}")
            elif topic.startswith("Log/Brana/"):
                self.log(f"📝 ACTIVITY LOG: {topic} = {payload}")
            else:
                self.log(f"📨 MQTT: {topic} = {payload}")
                
        def on_disconnect(client, userdata, rc):
            self.log(f"🔌 Monitor disconnected (rc={rc})")
            
        client.on_connect = on_connect
        client.on_message = on_message
        client.on_disconnect = on_disconnect
        
        try:
            client.connect("89.24.76.191", 9001, 60)
            client.loop_forever()
        except Exception as e:
            self.log(f"❌ Monitor exception: {e}")
            
    def monitor_network_connections(self):
        """Monitor network connections in real-time"""
        import subprocess
        
        self.log("🔍 Starting network connection monitor...")
        last_count = 0
        
        while self.monitoring:
            try:
                result = subprocess.run(['lsof', '-i', ':9001', '-P'], 
                                      capture_output=True, text=True)
                                      
                if result.returncode == 0:
                    lines = [l for l in result.stdout.strip().split('\n')[1:] if l.strip()]
                    current_count = len(lines)
                    
                    if current_count != last_count:
                        self.log(f"📊 MQTT connections changed: {last_count} → {current_count}", "WARN")
                        for line in lines:
                            if "chromium" in line.lower():
                                self.log(f"  🌐 BROWSER: {line}")
                            elif "node" in line.lower():
                                self.log(f"  ⚙️  NODE: {line}")
                            else:
                                self.log(f"  ❓ OTHER: {line}")
                        last_count = current_count
                        
            except Exception as e:
                self.log(f"❌ Network monitor error: {e}")
                
            time.sleep(2)  # Check every 2 seconds
            
    def run_monitor(self):
        """Run both monitors simultaneously"""
        self.log("🚀 Starting comprehensive MQTT monitoring...")
        self.log("💡 This will show real-time MQTT activity and connection changes")
        self.log("🔍 Looking for connack timeouts and connection issues...")
        self.log("=" * 70)
        
        # Start network monitor in separate thread
        network_thread = threading.Thread(target=self.monitor_network_connections)
        network_thread.daemon = True
        network_thread.start()
        
        # Run MQTT monitor in main thread
        try:
            self.monitor_mqtt_messages()
        except KeyboardInterrupt:
            self.log("🛑 Monitoring stopped by user")
            self.monitoring = False
        except Exception as e:
            self.log(f"💥 Fatal error: {e}")

if __name__ == "__main__":
    print("🔍 MQTT Real-Time Monitor v1.0")
    print("================================")
    print("💡 Press Ctrl+C to stop monitoring")
    print("🎯 Open http://localhost:3000 in browser to trigger MQTT activity")
    print()
    
    monitor = MqttRealTimeMonitor()
    monitor.run_monitor()