import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../Layouts/AppLayout';
import { StudentDashboard } from '../dashboards/StudentDashboard';
import { ResidentialWardenDashboard } from '../dashboards/ResidentialWardenDashboard';
import { WardenDashboard } from '../dashboards/WardenDashboard';
import { ChiefWardenDashboard } from '../dashboards/ChiefWardenDashboard';
import { DirectorDashboard } from '../dashboards/DirectorDashboard';
import { CaretakerBiometricDashboard } from '../dashboards/CaretakerBiometricDashboard';
import { CaretakerDashboard } from '../dashboards/CaretakerDashboard';

function DashboardContent() {
    const { user } = useAuth();

    switch (user?.role) {
        case 'student': return <StudentDashboard />;
        case 'residential_warden': return <ResidentialWardenDashboard />;
        case 'warden': return <WardenDashboard />;
        case 'chief_warden': return <ChiefWardenDashboard />;
        case 'admin': return <DirectorDashboard officeRole="admin" />;
        case 'director': return <DirectorDashboard />;
        case 'caretaker': return <CaretakerDashboard />;
        case 'caretaker_operator':
            return <CaretakerBiometricDashboard />;
        default: return <StudentDashboard />;
    }
}

export default function Dashboard() {
    return <AppLayout><DashboardContent /></AppLayout>;
}
