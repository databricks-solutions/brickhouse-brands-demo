import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, CheckCircle, Package, Loader2 } from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useDarkModeStore } from "@/store/useDarkModeStore";

type FilterType = 'pending_review' | 'expired_sla' | 'approved' | 'fulfilled' | null;

export const OrderAnalyticsCards = () => {
    const { statusSummary, isLoadingStatusSummary, error, fetchOrderStatusSummary, setFilters, filters } = useOrderStore();
    const { isDarkMode } = useDarkModeStore();
    const [activeFilter, setActiveFilter] = useState<FilterType>(null);

    useEffect(() => {
        // Fetch status summary when component mounts or region/category filter changes
        fetchOrderStatusSummary(filters.region, filters.category);

        // Set initial active filter based on current order store state
        if (filters.status && filters.status !== 'all') {
            setActiveFilter(filters.status as FilterType);
        }
    }, [fetchOrderStatusSummary, filters.region, filters.category]); // Include category in dependencies

    // Sync active filter with order store filters
    useEffect(() => {
        if (filters.expiredSlaOnly) {
            // If expired SLA only is true, show expired_sla as active
            setActiveFilter('expired_sla');
        } else if (filters.status === 'all' || !filters.status) {
            setActiveFilter(null);
        } else if (filters.status === 'pending_review') {
            // For regular pending review (not expired SLA)
            setActiveFilter('pending_review');
        } else {
            setActiveFilter(filters.status as FilterType);
        }
    }, [filters.status, filters.expiredSlaOnly]);

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    const handleCardClick = (filterType: FilterType) => {
        if (activeFilter === filterType) {
            // Clicking the same card - remove filter but preserve other filters
            setActiveFilter(null);
            setFilters({
                ...filters,
                status: 'all',
                expiredSlaOnly: false
            });
        } else {
            // Clicking a different card - apply filter but preserve other filters
            setActiveFilter(filterType);

            if (filterType === 'expired_sla') {
                // For expired SLA, we only need expiredSlaOnly=true, backend will handle the rest
                setFilters({
                    ...filters,
                    status: 'all', // Let backend handle status filtering
                    expiredSlaOnly: true
                });
            } else if (filterType) {
                setFilters({
                    ...filters,
                    status: filterType,
                    expiredSlaOnly: false
                });
            }
        }
    };

    const getStatusCards = () => {
        if (!statusSummary) return [];

        const { status_counts, expired_sla_count } = statusSummary;

        return [
            {
                title: "Expired SLA",
                value: formatNumber(expired_sla_count),
                icon: AlertTriangle,
                description: "over 2 days old",
                color: isDarkMode ? "text-red-400" : "text-red-600",
                bgColor: isDarkMode ? "bg-red-900/20" : "bg-red-50",
                iconColor: isDarkMode ? "text-red-400" : "text-red-600",
                filterType: 'expired_sla' as FilterType,
                hoverColor: isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-100",
                activeColor: isDarkMode ? "bg-red-900/40 border-red-400" : "bg-red-100 border-red-300"
            },
            {
                title: "Pending Review",
                value: formatNumber(status_counts.pending_review),
                icon: Clock,
                description: "awaiting approval",
                color: isDarkMode ? "text-yellow-400" : "text-yellow-600",
                bgColor: isDarkMode ? "bg-yellow-900/20" : "bg-yellow-50",
                iconColor: isDarkMode ? "text-yellow-400" : "text-yellow-600",
                filterType: 'pending_review' as FilterType,
                hoverColor: isDarkMode ? "hover:bg-yellow-900/30" : "hover:bg-yellow-100",
                activeColor: isDarkMode ? "bg-yellow-900/40 border-yellow-400" : "bg-yellow-100 border-yellow-300"
            },
            {
                title: "Approved Orders",
                value: formatNumber(status_counts.approved),
                icon: CheckCircle,
                description: "ready for fulfillment",
                color: isDarkMode ? "text-blue-400" : "text-blue-600",
                bgColor: isDarkMode ? "bg-blue-900/20" : "bg-blue-50",
                iconColor: isDarkMode ? "text-blue-400" : "text-blue-600",
                filterType: 'approved' as FilterType,
                hoverColor: isDarkMode ? "hover:bg-blue-900/30" : "hover:bg-blue-100",
                activeColor: isDarkMode ? "bg-blue-900/40 border-blue-400" : "bg-blue-100 border-blue-300"
            },
            {
                title: "Fulfilled Orders",
                value: formatNumber(status_counts.fulfilled),
                icon: Package,
                description: "completed orders",
                color: isDarkMode ? "text-green-400" : "text-green-600",
                bgColor: isDarkMode ? "bg-green-900/20" : "bg-green-50",
                iconColor: isDarkMode ? "text-green-400" : "text-green-600",
                filterType: 'fulfilled' as FilterType,
                hoverColor: isDarkMode ? "hover:bg-green-900/30" : "hover:bg-green-100",
                activeColor: isDarkMode ? "bg-green-900/40 border-green-400" : "bg-green-100 border-green-300"
            }
        ];
    };

    if (error) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className={`col-span-full ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
                    <CardContent className="pt-6">
                        <div className={`text-center ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                            <p className="font-medium">Error loading order analytics</p>
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
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
                    <Card key={index} className={`hover:shadow-lg transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''
                        }`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                <div className={`h-4 w-20 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                    }`}></div>
                            </CardTitle>
                            <Loader2 className={`h-4 w-4 animate-spin ${isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                }`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`h-8 w-16 rounded animate-pulse mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                }`}></div>
                            <div className={`h-4 w-24 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                }`}></div>
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
                    ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}
                    ${isActive
                        ? `${card.activeColor} border-2 shadow-md`
                        : `hover:shadow-lg ${card.hoverColor} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`
                    }
                `;

                return (
                    <Card
                        key={index}
                        className={cardClasses}
                        onClick={() => handleCardClick(card.filterType)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                }`}>
                                {card.title}
                                {isActive && (
                                    <span className={`ml-2 text-xs px-2 py-1 rounded-full font-normal ${isDarkMode
                                        ? 'bg-gray-700 text-gray-300'
                                        : 'bg-white text-gray-700'
                                        }`}>
                                        Active
                                    </span>
                                )}
                            </CardTitle>
                            <div className={`p-2 rounded-full ${isActive
                                ? (isDarkMode ? 'bg-gray-700' : 'bg-white')
                                : card.bgColor
                                }`}>
                                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${card.color}`}>
                                {card.value}
                            </div>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
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