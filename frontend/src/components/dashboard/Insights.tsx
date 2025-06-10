import { KPICards } from "./KPICards";
import { InventoryCharts } from "./InventoryCharts";

export const Insights = () => {
    return (
        <div className="space-y-6">
            {/* KPIs */}
            <KPICards />

            {/* Charts */}
            <InventoryCharts />
        </div>
    );
}; 