#!/usr/bin/env python3
"""
MQTT Debug Tool - Systematic testing of MQTT connections
Helps identify root cause of connack timeout and multiple connections
"""

import paho.mqtt.client as mqtt
import json
import time
import threading
import requests
import subprocess
import sys
from datetime import datetime

class MqttDebugTool:
    def __init__(self):
        self.test_results = []
        self.active_clients = []
        self.message_count = 0
        self.connection_attempts = 0
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] {level}: {message}")
        
    def test_mqtt_broker_direct(self, broker_host="89.24.76.191", broker_port=9001):
        """Test direct connection to MQTT broker"""
        self.log("🔍 Testing direct MQTT broker connection...")
        
        client_id = f"debug-tool-{int(time.time())}"
        client = mqtt.Client(client_id)
        
        connection_result = {"success": False, "error": None, "time": None}
        
        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                connection_result["success"] = True
                connection_result["time"] = time.time()
                self.log(f"✅ Direct MQTT connection successful (rc={rc})")
                client.subscribe("IoT/Brana/Status")
            else:
                connection_result["error"] = f"Connection failed with code {rc}"
                self.log(f"❌ Direct MQTT connection failed (rc={rc})")
        
        def on_message(client, userdata, msg):
            self.message_count += 1
            self.log(f"📨 Message: {msg.topic} = {msg.payload.decode()}")
            
        def on_disconnect(client, userdata, rc):
            self.log(f"🔌 Disconnected from MQTT broker (rc={rc})")
            
        client.on_connect = on_connect
        client.on_message = on_message  
        client.on_disconnect = on_disconnect
        
        start_time = time.time()
        try:
            self.log(f"🔌 Connecting to ws://{broker_host}:{broker_port}")
            client.connect(broker_host, broker_port, 60)
            client.loop_start()
            
            # Wait for connection result
            timeout = 15
            while time.time() - start_time < timeout:
                if connection_result["success"] or connection_result["error"]:
                    break
                time.sleep(0.1)
                
            if not connection_result["success"] and not connection_result["error"]:
                connection_result["error"] = "Connection timeout after 15s"
                
            # Keep connection alive for a bit to test stability
            if connection_result["success"]:
                self.log("📡 Testing message reception for 10 seconds...")
                time.sleep(10)
                
            client.loop_stop()
            client.disconnect()
            
        except Exception as e:
            connection_result["error"] = str(e)
            self.log(f"❌ Exception: {e}")
            
        self.active_clients.append(client)
        self.test_results.append({
            "test": "direct_mqtt",
            "result": connection_result,
            "messages_received": self.message_count
        })
        
        return connection_result["success"]
        
    def test_http_proxy(self, proxy_url="http://localhost:3003/api/mqtt-proxy"):
        """Test HTTP MQTT proxy"""
        self.log("🌐 Testing HTTP MQTT proxy...")
        
        try:
            # GET request
            response = requests.get(proxy_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ HTTP Proxy GET: {data}")
                
                # Test POST request
                post_data = {"topic": "IoT/Brana/Ovladani", "message": "debug-test"}
                post_response = requests.post(proxy_url, json=post_data, timeout=10)
                
                if post_response.status_code == 200:
                    post_result = post_response.json()
                    self.log(f"✅ HTTP Proxy POST: {post_result}")
                    
                    self.test_results.append({
                        "test": "http_proxy", 
                        "result": {"success": True, "get": data, "post": post_result}
                    })
                    return True
                else:
                    self.log(f"❌ HTTP Proxy POST failed: {post_response.status_code}")
                    
            else:
                self.log(f"❌ HTTP Proxy failed: {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ HTTP Proxy exception: {e}")
            
        self.test_results.append({"test": "http_proxy", "result": {"success": False}})
        return False
        
    def check_network_connections(self):
        """Check active network connections to MQTT port"""
        self.log("🔍 Checking network connections to MQTT port...")
        
        try:
            result = subprocess.run(['lsof', '-i', ':9001', '-P'], 
                                  capture_output=True, text=True)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')[1:]  # Skip header
                self.log(f"📊 Found {len(lines)} active connections:")
                
                for line in lines:
                    if line.strip():
                        self.log(f"  🔗 {line}")
                        
                self.test_results.append({
                    "test": "network_connections",
                    "result": {"count": len(lines), "connections": lines}
                })
                
            else:
                self.log("❌ Failed to check network connections")
                
        except Exception as e:
            self.log(f"❌ Network check exception: {e}")
            
    def test_multiple_connections(self, count=3):
        """Test creating multiple MQTT connections to identify issues"""
        self.log(f"🔄 Testing {count} simultaneous MQTT connections...")
        
        clients = []
        results = []
        
        def create_client(index):
            client_id = f"debug-multi-{index}-{int(time.time())}"
            client = mqtt.Client(client_id)
            
            result = {"client_id": client_id, "connected": False, "error": None}
            
            def on_connect(client, userdata, flags, rc):
                if rc == 0:
                    result["connected"] = True
                    self.log(f"✅ Client {index} connected successfully")
                else:
                    result["error"] = f"Connection failed rc={rc}"
                    self.log(f"❌ Client {index} failed: rc={rc}")
                    
            client.on_connect = on_connect
            
            try:
                client.connect("89.24.76.191", 9001, 60)
                client.loop_start()
                time.sleep(5)  # Wait for connection
                client.loop_stop()
                
            except Exception as e:
                result["error"] = str(e)
                self.log(f"❌ Client {index} exception: {e}")
                
            results.append(result)
            clients.append(client)
            
        # Create multiple clients
        threads = []
        for i in range(count):
            thread = threading.Thread(target=create_client, args=(i,))
            threads.append(thread)
            thread.start()
            
        # Wait for all to complete
        for thread in threads:
            thread.join()
            
        # Cleanup
        for client in clients:
            try:
                client.disconnect()
            except:
                pass
                
        successful = sum(1 for r in results if r["connected"])
        self.log(f"📊 Multiple connection test: {successful}/{count} successful")
        
        self.test_results.append({
            "test": "multiple_connections",
            "result": {"successful": successful, "total": count, "details": results}
        })
        
        return successful
        
    def generate_report(self):
        """Generate comprehensive debug report"""
        self.log("📋 Generating debug report...")
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": len(self.test_results),
                "messages_received": self.message_count,
                "connection_attempts": self.connection_attempts
            },
            "tests": self.test_results,
            "recommendations": []
        }
        
        # Analyze results and add recommendations
        for test in self.test_results:
            if test["test"] == "direct_mqtt" and not test["result"].get("success"):
                report["recommendations"].append(
                    "❌ Direct MQTT connection failed - check broker accessibility and firewall"
                )
                
            elif test["test"] == "network_connections":
                conn_count = test["result"].get("count", 0)
                if conn_count > 4:
                    report["recommendations"].append(
                        f"⚠️ Too many MQTT connections ({conn_count}) - investigate connection leaks"
                    )
                    
            elif test["test"] == "multiple_connections":
                success_rate = test["result"]["successful"] / test["result"]["total"]
                if success_rate < 0.8:
                    report["recommendations"].append(
                        f"❌ Low connection success rate ({success_rate:.1%}) - broker may be overloaded"
                    )
        
        # Save report
        with open('mqtt-debug-report.json', 'w') as f:
            json.dump(report, f, indent=2)
            
        self.log("💾 Debug report saved to mqtt-debug-report.json")
        return report
        
    def run_full_diagnosis(self):
        """Run complete MQTT diagnosis"""
        self.log("🚀 Starting comprehensive MQTT diagnosis...")
        self.log("=" * 60)
        
        # Test 1: Direct MQTT connection
        self.test_mqtt_broker_direct()
        
        time.sleep(2)
        
        # Test 2: HTTP Proxy
        self.test_http_proxy()
        
        time.sleep(2)
        
        # Test 3: Check existing connections
        self.check_network_connections() 
        
        time.sleep(2)
        
        # Test 4: Multiple connections stress test
        self.test_multiple_connections(3)
        
        # Generate final report
        self.log("=" * 60)
        report = self.generate_report()
        
        self.log("🎯 DIAGNOSIS COMPLETE!")
        self.log("📋 Check mqtt-debug-report.json for detailed results")
        
        if report["recommendations"]:
            self.log("⚠️  RECOMMENDATIONS:")
            for rec in report["recommendations"]:
                self.log(f"   {rec}")
        else:
            self.log("✅ No critical issues found in basic tests")
            
        return report

if __name__ == "__main__":
    print("🤖 MQTT Debug Tool v1.0")
    print("=" * 50)
    
    tool = MqttDebugTool()
    
    try:
        # Run comprehensive diagnosis
        report = tool.run_full_diagnosis()
        
        # Exit with appropriate code
        has_errors = any(not test["result"].get("success", True) 
                        for test in report["tests"] 
                        if "success" in test["result"])
                        
        sys.exit(1 if has_errors else 0)
        
    except KeyboardInterrupt:
        print("\n🛑 Debug session interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)