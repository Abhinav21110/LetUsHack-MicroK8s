'use client';

import { useEffect, useState } from 'react';

interface K8sStatus {
  summary: {
    totalNamespaces: number;
    totalPods: number;
    runningPods: number;
    totalDeployments: number;
    totalServices: number;
    totalIngresses: number;
  };
  namespaces: any[];
  pods: any[];
  deployments: any[];
  services: any[];
  ingresses: any[];
  cluster: any;
  timestamp: string;
}

export default function K8sDashboard() {
  const [status, setStatus] = useState<K8sStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/k8s-status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl">Loading Kubernetes Status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-2">❌ Error</h2>
            <p className="text-red-200">{error}</p>
            <button
              onClick={fetchStatus}
              className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">☸️ Kubernetes Dashboard</h1>
            <p className="text-gray-400">Real-time cluster monitoring</p>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Auto-refresh (5s)</span>
            </label>
            <button
              onClick={fetchStatus}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-blue-400">{status?.summary.totalNamespaces}</div>
            <div className="text-sm text-gray-400 mt-1">Namespaces</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-green-400">{status?.summary.runningPods}/{status?.summary.totalPods}</div>
            <div className="text-sm text-gray-400 mt-1">Pods Running</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-purple-400">{status?.summary.totalDeployments}</div>
            <div className="text-sm text-gray-400 mt-1">Deployments</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-yellow-400">{status?.summary.totalServices}</div>
            <div className="text-sm text-gray-400 mt-1">Services</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-pink-400">{status?.summary.totalIngresses}</div>
            <div className="text-sm text-gray-400 mt-1">Ingresses</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-cyan-400">{status?.cluster.nodeCount}</div>
            <div className="text-sm text-gray-400 mt-1">Nodes</div>
          </div>
        </div>

        {/* Pods Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">🚀 Pods ({status?.pods.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Namespace</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ready</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Restarts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Node</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {status?.pods.map((pod, idx) => (
                  <tr key={idx} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{pod.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{pod.namespace}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        pod.status === 'Running' ? 'bg-green-900 text-green-300' :
                        pod.status === 'Pending' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {pod.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{pod.ready}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{pod.restarts}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">{pod.ip || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{pod.node}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Services Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">🔌 Services ({status?.services.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Namespace</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cluster IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {status?.services.map((svc, idx) => (
                  <tr key={idx} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{svc.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{svc.namespace}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{svc.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">{svc.clusterIP}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{svc.ports?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ingresses Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">🌐 Ingresses ({status?.ingresses.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Namespace</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Hosts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Paths</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {status?.ingresses.map((ing, idx) => (
                  <tr key={idx} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{ing.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{ing.namespace}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{ing.hosts?.join(', ') || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{ing.paths?.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cluster Info */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold">🖥️ Cluster Nodes</h2>
          </div>
          <div className="p-6">
            {status?.cluster.nodes.map((node: any, idx: number) => (
              <div key={idx} className="mb-4 p-4 bg-gray-750 rounded">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold">{node.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    node.status === 'True' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {node.status === 'True' ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Version:</span> {node.version}
                  </div>
                  <div>
                    <span className="text-gray-400">OS:</span> {node.os}
                  </div>
                  <div>
                    <span className="text-gray-400">CPU:</span> {node.capacity?.cpu} / {node.allocatable?.cpu}
                  </div>
                  <div>
                    <span className="text-gray-400">Memory:</span> {node.capacity?.memory} / {node.allocatable?.memory}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : '-'}
        </div>
      </div>
    </div>
  );
}
