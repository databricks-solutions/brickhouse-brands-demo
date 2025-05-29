import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, CheckCircle, Package, Loader2 } from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useInventoryStore } from "@/store/useInventoryStore";

type FilterType = 'pending_review' | 'expired_sla' | 'approved' | 'fulfilled' | null;

export const OrderAnalyticsCards = () => {
    const { statusSummary, isLoadingStatusSummary, error, fetchOrderStatusSummary, setFilters, filters } = useOrderStore();
    const { filters: inventoryFilters } = useInventoryStore();
    const [activeFilter, setActiveFilter] = useState<FilterType>(null);

    useEffect(() => {
        // Fetch status summary when component mounts or region filter changes
        fetchOrderStatusSummary(inventoryFilters.region);

        // Set initial active filter based on current order store state
        if (filters.status && filters.status !== 'all') {
            setActiveFilter(filters.status as FilterType);
        }
    }, [fetchOrderStatusSummary, inventoryFilters.region]); // Only run on mount and region change

    // Sync active filter with order store filters
    useEffect(() => {
        if (filters.status === 'all' || !filters.status) {
            setActiveFilter(null);
        } else if (filters.status === 'pending_review') {
            // Could be either pending_review or expired_sla, keep current activeFilter if it's one of those
            if (activeFilter !== 'pending_review' && activeFilter !== 'expired_sla') {
                setActiveFilter('pending_review');
            }
        } else {
            setActiveFilter(filters.status as FilterType);
        }
    }, [filters.status, activeFilter]);

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    const handleCardClick = (filterType: FilterType) => {
        if (activeFilter === filterType) {
            // Clicking the same card - remove filter
            setActiveFilter(null);
            setFilters({ status: 'all' });
        } else {
            // Clicking a different card - apply filter
            setActiveFilter(filterType);

            if (filterType === 'expired_sla') {
                // For expired SLA, we filter by pending_review status
                // The backend logic already handles the 2-day logic in the summary
                setFilters({ status: 'pending_review' });
            } else if (filterType) {
                setFilters({ status: filterType });
            }
        }
    };

    const getStatusCards = () => {
        if (!statusSummary) return [];

        const { status_counts, expired_sla_count } = statusSummary;

        return [
            {
                title: "Pending Review",
                value: formatNumber(status_counts.pending_review),
                icon: Clock,
                description: "awaiting approval",
                color: "text-yellow-600",
                bgColor: "bg-yellow-50",
                iconColor: "text-yellow-600",
                filterType: 'pending_review' as FilterType,
                hoverColor: "hover:bg-yellow-100",
                activeColor: "bg-yellow-100 border-yellow-300"
            },
            {
                title: "Expired SLA",
                value: formatNumber(expired_sla_count),
                icon: AlertTriangle,
                description: "over 2 days old",
                color: "text-red-600",
                bgColor: "bg-red-50",
                iconColor: "text-red-600",
                filterType: 'expired_sla' as FilterType,
                hoverColor: "hover:bg-red-100",
                activeColor: "bg-red-100 border-red-300"
            },
            {
                title: "Approved Orders",
                value: formatNumber(status_counts.approved),
                icon: CheckCircle,
                description: "ready for fulfillment",
                color: "text-blue-600",
                bgColor: "bg-blue-50",
                iconColor: "text-blue-600",
                filterType: 'approved' as FilterType,
                hoverColor: "hover:bg-blue-100",
                activeColor: "bg-blue-100 border-blue-300"
            },
            {
                title: "Fulfilled Orders",
                value: formatNumber(status_counts.fulfilled),
                icon: Package,
                description: "completed orders",
                color: "text-green-600",
                bgColor: "bg-green-50",
                iconColor: "text-green-600",
                filterType: 'fulfilled' as FilterType,
                hoverColor: "hover:bg-green-100",
                activeColor: "bg-green-100 border-green-300"
            }
        ];
    };

    if (error) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="col-span-full">
                    <CardContent className="pt-6">
                        <div className="text-center text-red-600">
                            <p className="font-medium">Error loading order analytics</p>
                            <p className="text-sm text-gray-600 mt-1">{error}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoadingStatusSummary || !statusSummary) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                            </CardTitle>
                            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const cards = getStatusCards();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, index) => {
                const isActive = activeFilter === card.filterType;
                const cardClasses = `
                    cursor-pointer transition-all duration-200 
                    ${isActive
                        ? `${card.activeColor} border-2 shadow-md`
                        : `hover:shadow-lg ${card.hoverColor} border border-gray-200`
                    }
                `;

                return (
                    <Card
                        key={index}
                        className={cardClasses}
                        onClick={() => handleCardClick(card.filterType)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">
                                {card.title}
                                {isActive && (
                                    <span className="ml-2 text-xs px-2 py-1 bg-white rounded-full text-gray-700 font-normal">
                                        Active
                                    </span>
                                )}
                            </CardTitle>
                            <div className={`p-2 rounded-full ${isActive ? 'bg-white' : card.bgColor}`}>
                                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${card.color}`}>
                                {card.value}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {card.description}
                                {isActive && " • Click to clear filter"}
                            </p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}; 