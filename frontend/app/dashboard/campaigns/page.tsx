export default async function CampaignsPage() {
  // Obtener campañas con métricas
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  let campaigns = [];
  let error = null;

  try {
    const response = await fetch(`${API_URL}/api/v1/meta-ads/campaigns-with-insights`, {
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        campaigns = data.data || [];
      }
    }
  } catch (e: any) {
    error = e.message;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Campañas de Meta Ads
          </h1>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-sm text-red-700">
                Error al cargar campañas: {error}
              </p>
            </div>
          )}

          {campaigns.length === 0 && !error && (
            <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
              <p className="text-sm text-gray-700">
                No hay campañas con datos en este período
              </p>
            </div>
          )}

          {campaigns.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre de Campaña
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gasto
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Impresiones
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clicks
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Alcance
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CTR
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPC
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPM
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {campaigns.map((campaign: any) => (
                      <tr key={campaign.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {campaign.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-semibold">
                          ${campaign.spend.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                          {campaign.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                          {campaign.clicks.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                          {campaign.reach.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            campaign.ctr > 3.0
                              ? 'bg-green-100 text-green-800'
                              : campaign.ctr > 1.0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {campaign.ctr.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          ${campaign.cpc.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          ${campaign.cpm.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <a
                            href={`https://www.facebook.com/adsmanager/manage/campaigns?act=&selected_campaign_ids=${campaign.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Ver en Meta
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen al final */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Total Campañas</p>
                    <p className="text-lg font-semibold text-gray-900">{campaigns.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Gasto Total</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${campaigns.reduce((sum: number, c: any) => sum + c.spend, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Impresiones Totales</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {campaigns.reduce((sum: number, c: any) => sum + c.impressions, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Clicks Totales</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {campaigns.reduce((sum: number, c: any) => sum + c.clicks, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
