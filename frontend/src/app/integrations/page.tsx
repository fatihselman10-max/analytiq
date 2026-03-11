"use client";

import { useState, useEffect } from "react";
import { integrationsAPI } from "@/lib/api";
import { Integration } from "@/types";
import {
  Plug,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

const PLATFORMS = {
  marketplace: [
    {
      id: "trendyol",
      name: "Trendyol",
      fields: ["api_key", "api_secret", "seller_id"],
    },
    {
      id: "hepsiburada",
      name: "Hepsiburada",
      fields: ["api_key", "merchant_id"],
    },
    {
      id: "n11",
      name: "N11",
      fields: ["api_key", "api_secret"],
    },
    {
      id: "amazon",
      name: "Amazon TR",
      fields: ["seller_id", "mws_auth_token", "access_key"],
    },
    {
      id: "ciceksepeti",
      name: "Çiçeksepeti",
      fields: ["api_key"],
    },
  ],
  ecommerce: [
    {
      id: "shopify",
      name: "Shopify",
      fields: ["shop_domain", "api_key", "api_secret"],
    },
    {
      id: "woocommerce",
      name: "WooCommerce",
      fields: ["site_url", "consumer_key", "consumer_secret"],
    },
    {
      id: "ticimax",
      name: "Ticimax",
      fields: ["api_url", "username", "password"],
    },
    {
      id: "ideasoft",
      name: "IdeaSoft",
      fields: ["site_url", "api_key"],
    },
    {
      id: "tsoft",
      name: "T-Soft",
      fields: ["site_url", "api_key", "api_secret"],
    },
    {
      id: "ikas",
      name: "ikas",
      fields: ["store_url", "api_key"],
    },
  ],
  advertising: [
    {
      id: "meta",
      name: "Meta (Facebook/Instagram)",
      fields: ["access_token", "ad_account_id"],
    },
    {
      id: "google",
      name: "Google Ads",
      fields: ["developer_token", "customer_id", "refresh_token"],
    },
    {
      id: "tiktok",
      name: "TikTok Ads",
      fields: ["access_token", "advertiser_id"],
    },
  ],
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data } = await integrationsAPI.list();
      setIntegrations(data.integrations || []);
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPlatform) return;
    const allPlatforms = [
      ...PLATFORMS.marketplace,
      ...PLATFORMS.ecommerce,
      ...PLATFORMS.advertising,
    ];
    const platform = allPlatforms.find((p) => p.id === selectedPlatform);
    if (!platform) return;

    let platformType = "marketplace";
    if (PLATFORMS.ecommerce.find((p) => p.id === selectedPlatform))
      platformType = "ecommerce";
    if (PLATFORMS.advertising.find((p) => p.id === selectedPlatform))
      platformType = "advertising";

    try {
      await integrationsAPI.create({
        platform: selectedPlatform,
        platform_type: platformType,
        credentials,
      });
      setShowModal(false);
      setSelectedPlatform(null);
      setCredentials({});
      fetchIntegrations();
    } catch (err) {
      console.error("Failed to create integration:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu entegrasyonu silmek istediğinize emin misiniz?")) return;
    try {
      await integrationsAPI.delete(id);
      fetchIntegrations();
    } catch (err) {
      console.error("Failed to delete integration:", err);
    }
  };

  const handleSync = async (id: number) => {
    try {
      await integrationsAPI.sync(id);
      alert("Senkronizasyon başlatıldı");
    } catch (err) {
      console.error("Failed to sync:", err);
    }
  };

  const getSelectedFields = () => {
    const allPlatforms = [
      ...PLATFORMS.marketplace,
      ...PLATFORMS.ecommerce,
      ...PLATFORMS.advertising,
    ];
    return allPlatforms.find((p) => p.id === selectedPlatform)?.fields || [];
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "active")
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === "error")
      return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Entegrasyonlar</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Entegrasyon Ekle
        </button>
      </div>

      {/* Categories */}
      {(["marketplace", "ecommerce", "advertising"] as const).map((type) => {
        const typeLabels = {
          marketplace: "Pazaryerleri",
          ecommerce: "E-Ticaret Altyapıları",
          advertising: "Reklam Platformları",
        };
        const typeIntegrations = integrations.filter(
          (i) => i.platform_type === type
        );

        return (
          <div key={type}>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              {typeLabels[type]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PLATFORMS[type].map((platform) => {
                const integration = typeIntegrations.find(
                  (i) => i.platform === platform.id
                );
                return (
                  <div
                    key={platform.id}
                    className={`bg-white rounded-xl border p-4 ${
                      integration
                        ? "border-green-200"
                        : "border-gray-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Plug className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {platform.name}
                          </h3>
                          {integration ? (
                            <div className="flex items-center gap-1 mt-1">
                              <StatusIcon status={integration.status} />
                              <span className="text-xs text-gray-500">
                                {integration.last_sync_at
                                  ? `Son sync: ${integration.last_sync_at}`
                                  : "Henüz senkronize edilmedi"}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mt-1">
                              Bağlı değil
                            </p>
                          )}
                        </div>
                      </div>
                      {integration && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSync(integration.id)}
                            className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50"
                            title="Senkronize Et"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(integration.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Integration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Entegrasyon Ekle</h2>

            {!selectedPlatform ? (
              <div className="space-y-4">
                {(["marketplace", "ecommerce", "advertising"] as const).map(
                  (type) => (
                    <div key={type}>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        {type === "marketplace"
                          ? "Pazaryerleri"
                          : type === "ecommerce"
                          ? "E-Ticaret"
                          : "Reklam"}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {PLATFORMS[type].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPlatform(p.id)}
                            className="p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 text-sm text-left transition-colors"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setSelectedPlatform(null);
                    setCredentials({});
                  }}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Geri dön
                </button>
                {getSelectedFields().map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {field.replace(/_/g, " ")}
                    </label>
                    <input
                      type="text"
                      value={credentials[field] || ""}
                      onChange={(e) =>
                        setCredentials((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ))}
                <button
                  onClick={handleCreate}
                  className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Bağlan
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowModal(false);
                setSelectedPlatform(null);
                setCredentials({});
              }}
              className="mt-4 w-full py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
