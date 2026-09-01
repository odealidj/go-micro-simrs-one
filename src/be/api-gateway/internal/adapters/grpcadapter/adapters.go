// Package grpcadapter contains gRPC implementations of the service ports.
// To migrate a service to a message broker, implement the corresponding port
// interface in a new package (e.g. brokeradapter) and swap it in main.go.
package grpcadapter

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/circuitbreaker"
	gobreaker "github.com/sony/gobreaker"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
)

// ── Auth ──────────────────────────────────────────────────────────────────────

type AuthAdapter struct {
	client authpb.AuthServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewAuthAdapter(client authpb.AuthServiceClient, cb *gobreaker.CircuitBreaker) *AuthAdapter {
	return &AuthAdapter{client: client, cb: cb}
}

func (a *AuthAdapter) Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.LoginResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.LoginResponse, error) {
		return a.client.Login(ctx, req)
	})
}

func (a *AuthAdapter) RefreshToken(ctx context.Context, req *authpb.RefreshTokenRequest) (*authpb.RefreshTokenResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.RefreshTokenResponse, error) {
		return a.client.RefreshToken(ctx, req)
	})
}

func (a *AuthAdapter) Signup(ctx context.Context, req *authpb.SignupRequest) (*authpb.SignupResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.SignupResponse, error) {
		return a.client.Signup(ctx, req)
	})
}

func (a *AuthAdapter) ExtractKTPData(ctx context.Context, req *authpb.ExtractKTPDataRequest) (*authpb.ExtractKTPDataResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.ExtractKTPDataResponse, error) {
		return a.client.ExtractKTPData(ctx, req)
	})
}

func (a *AuthAdapter) ListLabelProfesi(ctx context.Context, req *authpb.ListLabelProfesiRequest) (*authpb.ListLabelProfesiResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.ListLabelProfesiResponse, error) {
		return a.client.ListLabelProfesi(ctx, req)
	})
}

func (a *AuthAdapter) ListUsers(ctx context.Context, req *authpb.ListUsersRequest) (*authpb.ListUsersResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.ListUsersResponse, error) {
		return a.client.ListUsers(ctx, req)
	})
}

func (a *AuthAdapter) UpdateUserStatus(ctx context.Context, req *authpb.UpdateUserStatusRequest) (*authpb.UpdateUserStatusResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.UpdateUserStatusResponse, error) {
		return a.client.UpdateUserStatus(ctx, req)
	})
}

func (a *AuthAdapter) DeleteUser(ctx context.Context, req *authpb.DeleteUserRequest) (*authpb.DeleteUserResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.DeleteUserResponse, error) {
		return a.client.DeleteUser(ctx, req)
	})
}

func (a *AuthAdapter) GetMasterRoles(ctx context.Context, req *authpb.GetMasterRolesRequest) (*authpb.GetMasterRolesResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetMasterRolesResponse, error) {
		return a.client.GetMasterRoles(ctx, req)
	})
}

func (a *AuthAdapter) GetDoctors(ctx context.Context, req *authpb.GetDoctorsRequest) (*authpb.GetDoctorsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetDoctorsResponse, error) {
		return a.client.GetDoctors(ctx, req)
	})
}

func (a *AuthAdapter) GetNurses(ctx context.Context, req *authpb.GetNursesRequest) (*authpb.GetNursesResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetNursesResponse, error) {
		return a.client.GetNurses(ctx, req)
	})
}

func (a *AuthAdapter) GetDoctorsByPoli(ctx context.Context, req *authpb.GetDoctorsByPoliRequest) (*authpb.GetDoctorsByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetDoctorsByPoliResponse, error) {
		return a.client.GetDoctorsByPoli(ctx, req)
	})
}

func (a *AuthAdapter) GetNursesByPoli(ctx context.Context, req *authpb.GetNursesByPoliRequest) (*authpb.GetNursesByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetNursesByPoliResponse, error) {
		return a.client.GetNursesByPoli(ctx, req)
	})
}

func (a *AuthAdapter) AssignDoctorPoli(ctx context.Context, req *authpb.AssignDoctorPoliRequest) (*authpb.AssignDoctorPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.AssignDoctorPoliResponse, error) {
		return a.client.AssignDoctorPoli(ctx, req)
	})
}

func (a *AuthAdapter) AssignNursePoli(ctx context.Context, req *authpb.AssignNursePoliRequest) (*authpb.AssignNursePoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.AssignNursePoliResponse, error) {
		return a.client.AssignNursePoli(ctx, req)
	})
}

func (a *AuthAdapter) UnassignDoctorPoli(ctx context.Context, req *authpb.UnassignDoctorPoliRequest) (*authpb.UnassignDoctorPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.UnassignDoctorPoliResponse, error) {
		return a.client.UnassignDoctorPoli(ctx, req)
	})
}

func (a *AuthAdapter) UnassignNursePoli(ctx context.Context, req *authpb.UnassignNursePoliRequest) (*authpb.UnassignNursePoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.UnassignNursePoliResponse, error) {
		return a.client.UnassignNursePoli(ctx, req)
	})
}

func (a *AuthAdapter) UpdatePoliSchedule(ctx context.Context, req *authpb.UpdatePoliScheduleRequest) (*authpb.UpdatePoliScheduleResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.UpdatePoliScheduleResponse, error) {
		return a.client.UpdatePoliSchedule(ctx, req)
	})
}

func (a *AuthAdapter) GetAssignedPoli(ctx context.Context, req *authpb.GetAssignedPoliRequest) (*authpb.GetAssignedPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetAssignedPoliResponse, error) {
		return a.client.GetAssignedPoli(ctx, req)
	})
}

func (a *AuthAdapter) GetActivePersonnelMetrics(ctx context.Context, req *authpb.GetActivePersonnelMetricsRequest) (*authpb.GetActivePersonnelMetricsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.GetActivePersonnelMetricsResponse, error) {
		return a.client.GetActivePersonnelMetrics(ctx, req)
	})
}

func (a *AuthAdapter) RegisterPatientUser(ctx context.Context, req *authpb.RegisterPatientUserRequest) (*authpb.RegisterPatientUserResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*authpb.RegisterPatientUserResponse, error) {
		return a.client.RegisterPatientUser(ctx, req)
	})
}

// ── Patient ───────────────────────────────────────────────────────────────────

type PatientAdapter struct {
	client patientpb.PatientServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewPatientAdapter(client patientpb.PatientServiceClient, cb *gobreaker.CircuitBreaker) *PatientAdapter {
	return &PatientAdapter{client: client, cb: cb}
}

func (a *PatientAdapter) RegisterPatient(ctx context.Context, req *patientpb.RegisterPatientRequest) (*patientpb.RegisterPatientResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*patientpb.RegisterPatientResponse, error) {
		return a.client.RegisterPatient(ctx, req)
	})
}

func (a *PatientAdapter) GetPatientByMRN(ctx context.Context, req *patientpb.GetPatientByMRNRequest) (*patientpb.GetPatientByMRNResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*patientpb.GetPatientByMRNResponse, error) {
		return a.client.GetPatientByMRN(ctx, req)
	})
}

func (a *PatientAdapter) SearchPatients(ctx context.Context, req *patientpb.SearchPatientsRequest) (*patientpb.SearchPatientsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*patientpb.SearchPatientsResponse, error) {
		return a.client.SearchPatients(ctx, req)
	})
}

func (a *PatientAdapter) DeletePatient(ctx context.Context, req *patientpb.DeletePatientRequest) (*patientpb.DeletePatientResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*patientpb.DeletePatientResponse, error) {
		return a.client.DeletePatient(ctx, req)
	})
}

// ── Registration ──────────────────────────────────────────────────────────────

type RegistrationAdapter struct {
	client regpb.RegistrationServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewRegistrationAdapter(client regpb.RegistrationServiceClient, cb *gobreaker.CircuitBreaker) *RegistrationAdapter {
	return &RegistrationAdapter{client: client, cb: cb}
}

func (a *RegistrationAdapter) RegisterEncounter(ctx context.Context, req *regpb.RegisterEncounterRequest) (*regpb.RegisterEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.RegisterEncounterResponse, error) {
		return a.client.RegisterEncounter(ctx, req)
	})
}

func (a *RegistrationAdapter) CancelEncounter(ctx context.Context, req *regpb.CancelEncounterRequest) (*regpb.CancelEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.CancelEncounterResponse, error) {
		return a.client.CancelEncounter(ctx, req)
	})
}

func (a *RegistrationAdapter) UpdateEncounterGuarantor(ctx context.Context, req *regpb.UpdateEncounterGuarantorRequest) (*regpb.UpdateEncounterGuarantorResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.UpdateEncounterGuarantorResponse, error) {
		return a.client.UpdateEncounterGuarantor(ctx, req)
	})
}

func (a *RegistrationAdapter) GetDashboardMetrics(ctx context.Context, req *regpb.GetDashboardMetricsRequest) (*regpb.GetDashboardMetricsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.GetDashboardMetricsResponse, error) {
		return a.client.GetDashboardMetrics(ctx, req)
	})
}

func (a *RegistrationAdapter) GetTodayEncounters(ctx context.Context, req *regpb.GetTodayEncountersRequest) (*regpb.GetTodayEncountersResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.GetTodayEncountersResponse, error) {
		return a.client.GetTodayEncounters(ctx, req)
	})
}

func (a *RegistrationAdapter) UpdateEncounterStatus(ctx context.Context, req *regpb.UpdateEncounterStatusRequest) (*regpb.UpdateEncounterStatusResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*regpb.UpdateEncounterStatusResponse, error) {
		return a.client.UpdateEncounterStatus(ctx, req)
	})
}

// ── EMR ───────────────────────────────────────────────────────────────────────

type EMRAdapter struct {
	client emrpb.EMRServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewEMRAdapter(client emrpb.EMRServiceClient, cb *gobreaker.CircuitBreaker) *EMRAdapter {
	return &EMRAdapter{client: client, cb: cb}
}

func (a *EMRAdapter) StartEncounter(ctx context.Context, req *emrpb.StartEncounterRequest) (*emrpb.StartEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.StartEncounterResponse, error) {
		return a.client.StartEncounter(ctx, req)
	})
}
func (a *EMRAdapter) CompleteEncounter(ctx context.Context, req *emrpb.CompleteEncounterRequest) (*emrpb.CompleteEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.CompleteEncounterResponse, error) {
		return a.client.CompleteEncounter(ctx, req)
	})
}
func (a *EMRAdapter) FinalizeMedicalRecord(ctx context.Context, req *emrpb.FinalizeMedicalRecordRequest) (*emrpb.FinalizeMedicalRecordResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.FinalizeMedicalRecordResponse, error) {
		return a.client.FinalizeMedicalRecord(ctx, req)
	})
}
func (a *EMRAdapter) GetMedicalRecord(ctx context.Context, req *emrpb.GetMedicalRecordRequest) (*emrpb.GetMedicalRecordResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMedicalRecordResponse, error) {
		return a.client.GetMedicalRecord(ctx, req)
	})
}
func (a *EMRAdapter) FinalizeSeverity(ctx context.Context, req *emrpb.FinalizeSeverityRequest) (*emrpb.FinalizeSeverityResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.FinalizeSeverityResponse, error) {
		return a.client.FinalizeSeverity(ctx, req)
	})
}
func (a *EMRAdapter) AddEncounterDiagnosis(ctx context.Context, req *emrpb.AddEncounterDiagnosisRequest) (*emrpb.AddEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.AddEncounterDiagnosisResponse, error) {
		return a.client.AddEncounterDiagnosis(ctx, req)
	})
}
func (a *EMRAdapter) UpdateEncounterDiagnosis(ctx context.Context, req *emrpb.UpdateEncounterDiagnosisRequest) (*emrpb.UpdateEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.UpdateEncounterDiagnosisResponse, error) {
		return a.client.UpdateEncounterDiagnosis(ctx, req)
	})
}
func (a *EMRAdapter) RemoveEncounterDiagnosis(ctx context.Context, req *emrpb.RemoveEncounterDiagnosisRequest) (*emrpb.RemoveEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.RemoveEncounterDiagnosisResponse, error) {
		return a.client.RemoveEncounterDiagnosis(ctx, req)
	})
}
func (a *EMRAdapter) SearchKBM(ctx context.Context, req *emrpb.SearchKBMRequest) (*emrpb.SearchKBMResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.SearchKBMResponse, error) {
		return a.client.SearchKBM(ctx, req)
	})
}
func (a *EMRAdapter) GetKBMDetail(ctx context.Context, req *emrpb.GetKBMDetailRequest) (*emrpb.GetKBMDetailResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetKBMDetailResponse, error) {
		return a.client.GetKBMDetail(ctx, req)
	})
}
func (a *EMRAdapter) GetICD10SuggestionsForKBM(ctx context.Context, req *emrpb.GetICD10SuggestionsForKBMRequest) (*emrpb.GetICD10SuggestionsForKBMResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetICD10SuggestionsForKBMResponse, error) {
		return a.client.GetICD10SuggestionsForKBM(ctx, req)
	})
}
func (a *EMRAdapter) GetKBMSuggestionsForICD10(ctx context.Context, req *emrpb.GetKBMSuggestionsForICD10Request) (*emrpb.GetKBMSuggestionsForICD10Response, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetKBMSuggestionsForICD10Response, error) {
		return a.client.GetKBMSuggestionsForICD10(ctx, req)
	})
}
func (a *EMRAdapter) ListPendingKBMVerifications(ctx context.Context, req *emrpb.ListPendingKBMVerificationsRequest) (*emrpb.ListPendingKBMVerificationsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.ListPendingKBMVerificationsResponse, error) {
		return a.client.ListPendingKBMVerifications(ctx, req)
	})
}
func (a *EMRAdapter) VerifyKBMMapping(ctx context.Context, req *emrpb.VerifyKBMMappingRequest) (*emrpb.VerifyKBMMappingResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.VerifyKBMMappingResponse, error) {
		return a.client.VerifyKBMMapping(ctx, req)
	})
}
func (a *EMRAdapter) GetPolyclinics(ctx context.Context, req *emrpb.GetPolyclinicsRequest) (*emrpb.GetPolyclinicsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetPolyclinicsResponse, error) {
		return a.client.GetPolyclinics(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterKBMs(ctx context.Context, req *emrpb.GetMasterKBMsRequest) (*emrpb.GetMasterKBMsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterKBMsResponse, error) {
		return a.client.GetMasterKBMs(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterKBMsByPoli(ctx context.Context, req *emrpb.GetMasterKBMsByPoliRequest) (*emrpb.GetMasterKBMsByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterKBMsByPoliResponse, error) {
		return a.client.GetMasterKBMsByPoli(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterTindakan(ctx context.Context, req *emrpb.GetMasterTindakanRequest) (*emrpb.GetMasterTindakanResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterTindakanResponse, error) {
		return a.client.GetMasterTindakan(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterTindakanByPoli(ctx context.Context, req *emrpb.GetMasterTindakanByPoliRequest) (*emrpb.GetMasterTindakanByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterTindakanByPoliResponse, error) {
		return a.client.GetMasterTindakanByPoli(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterICD10(ctx context.Context, req *emrpb.GetMasterICD10Request) (*emrpb.GetMasterICD10Response, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterICD10Response, error) {
		return a.client.GetMasterICD10(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterICD10ByPoli(ctx context.Context, req *emrpb.GetMasterICD10ByPoliRequest) (*emrpb.GetMasterICD10ByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterICD10ByPoliResponse, error) {
		return a.client.GetMasterICD10ByPoli(ctx, req)
	})
}
func (a *EMRAdapter) GetICD10MappingDetails(ctx context.Context, req *emrpb.GetICD10MappingDetailsRequest) (*emrpb.GetICD10MappingDetailsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetICD10MappingDetailsResponse, error) {
		return a.client.GetICD10MappingDetails(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterICD9(ctx context.Context, req *emrpb.GetMasterICD9Request) (*emrpb.GetMasterICD9Response, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterICD9Response, error) {
		return a.client.GetMasterICD9(ctx, req)
	})
}
func (a *EMRAdapter) GetICD9MappingDetails(ctx context.Context, req *emrpb.GetICD9MappingDetailsRequest) (*emrpb.GetICD9MappingDetailsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetICD9MappingDetailsResponse, error) {
		return a.client.GetICD9MappingDetails(ctx, req)
	})
}
func (a *EMRAdapter) GetICD9SuggestionsForTindakan(ctx context.Context, req *emrpb.GetICD9SuggestionsForTindakanRequest) (*emrpb.GetICD9SuggestionsForTindakanResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetICD9SuggestionsForTindakanResponse, error) {
		return a.client.GetICD9SuggestionsForTindakan(ctx, req)
	})
}
func (a *EMRAdapter) GetMasterSNOMED(ctx context.Context, req *emrpb.GetMasterSNOMEDRequest) (*emrpb.GetMasterSNOMEDResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetMasterSNOMEDResponse, error) {
		return a.client.GetMasterSNOMED(ctx, req)
	})
}
func (a *EMRAdapter) GetSNOMEDMappingDetails(ctx context.Context, req *emrpb.GetSNOMEDMappingDetailsRequest) (*emrpb.GetSNOMEDMappingDetailsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*emrpb.GetSNOMEDMappingDetailsResponse, error) {
		return a.client.GetSNOMEDMappingDetails(ctx, req)
	})
}

// ── Rawat Jalan ───────────────────────────────────────────────────────────────

type RawatJalanAdapter struct {
	client rawatjalanpb.RawatJalanServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewRawatJalanAdapter(client rawatjalanpb.RawatJalanServiceClient, cb *gobreaker.CircuitBreaker) *RawatJalanAdapter {
	return &RawatJalanAdapter{client: client, cb: cb}
}

func (a *RawatJalanAdapter) SubmitTriage(ctx context.Context, req *rawatjalanpb.SubmitTriageRequest) (*rawatjalanpb.SubmitTriageResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.SubmitTriageResponse, error) {
		return a.client.SubmitTriage(ctx, req)
	})
}
func (a *RawatJalanAdapter) StartEncounter(ctx context.Context, req *rawatjalanpb.StartEncounterRequest) (*rawatjalanpb.StartEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.StartEncounterResponse, error) {
		return a.client.StartEncounter(ctx, req)
	})
}
func (a *RawatJalanAdapter) CompleteEncounter(ctx context.Context, req *rawatjalanpb.CompleteEncounterRequest) (*rawatjalanpb.CompleteEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.CompleteEncounterResponse, error) {
		return a.client.CompleteEncounter(ctx, req)
	})
}
func (a *RawatJalanAdapter) FinalizeMedicalRecord(ctx context.Context, req *rawatjalanpb.FinalizeMedicalRecordRequest) (*rawatjalanpb.FinalizeMedicalRecordResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.FinalizeMedicalRecordResponse, error) {
		return a.client.FinalizeMedicalRecord(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetMedicalRecord(ctx context.Context, req *rawatjalanpb.GetMedicalRecordRequest) (*rawatjalanpb.GetMedicalRecordResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetMedicalRecordResponse, error) {
		return a.client.GetMedicalRecord(ctx, req)
	})
}
func (a *RawatJalanAdapter) FinalizeSeverity(ctx context.Context, req *rawatjalanpb.FinalizeSeverityRequest) (*rawatjalanpb.FinalizeSeverityResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.FinalizeSeverityResponse, error) {
		return a.client.FinalizeSeverity(ctx, req)
	})
}
func (a *RawatJalanAdapter) AddMedicalAction(ctx context.Context, req *rawatjalanpb.AddMedicalActionRequest) (*rawatjalanpb.AddMedicalActionResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.AddMedicalActionResponse, error) {
		return a.client.AddMedicalAction(ctx, req)
	})
}
func (a *RawatJalanAdapter) RemoveMedicalAction(ctx context.Context, req *rawatjalanpb.RemoveMedicalActionRequest) (*rawatjalanpb.RemoveMedicalActionResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.RemoveMedicalActionResponse, error) {
		return a.client.RemoveMedicalAction(ctx, req)
	})
}
func (a *RawatJalanAdapter) AddEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.AddEncounterDiagnosisRequest) (*rawatjalanpb.AddEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.AddEncounterDiagnosisResponse, error) {
		return a.client.AddEncounterDiagnosis(ctx, req)
	})
}
func (a *RawatJalanAdapter) UpdateEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.UpdateEncounterDiagnosisRequest) (*rawatjalanpb.UpdateEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.UpdateEncounterDiagnosisResponse, error) {
		return a.client.UpdateEncounterDiagnosis(ctx, req)
	})
}
func (a *RawatJalanAdapter) RemoveEncounterDiagnosis(ctx context.Context, req *rawatjalanpb.RemoveEncounterDiagnosisRequest) (*rawatjalanpb.RemoveEncounterDiagnosisResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.RemoveEncounterDiagnosisResponse, error) {
		return a.client.RemoveEncounterDiagnosis(ctx, req)
	})
}
func (a *RawatJalanAdapter) PromoteDiagnosisToPrimary(ctx context.Context, req *rawatjalanpb.PromoteDiagnosisToPrimaryRequest) (*rawatjalanpb.PromoteDiagnosisToPrimaryResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.PromoteDiagnosisToPrimaryResponse, error) {
		return a.client.PromoteDiagnosisToPrimary(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetKBMSuggestionsForICD10(ctx context.Context, req *rawatjalanpb.GetKBMSuggestionsForICD10Request) (*rawatjalanpb.GetKBMSuggestionsForICD10Response, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetKBMSuggestionsForICD10Response, error) {
		return a.client.GetKBMSuggestionsForICD10(ctx, req)
	})
}
func (a *RawatJalanAdapter) SearchKBM(ctx context.Context, req *rawatjalanpb.SearchKBMRequest) (*rawatjalanpb.SearchKBMResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.SearchKBMResponse, error) {
		return a.client.SearchKBM(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetKBMDetail(ctx context.Context, req *rawatjalanpb.GetKBMDetailRequest) (*rawatjalanpb.GetKBMDetailResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetKBMDetailResponse, error) {
		return a.client.GetKBMDetail(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetMasterTindakanByPoli(ctx context.Context, req *rawatjalanpb.GetMasterTindakanByPoliRequest) (*rawatjalanpb.GetMasterTindakanByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetMasterTindakanByPoliResponse, error) {
		return a.client.GetMasterTindakanByPoli(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetMasterICD10ByPoli(ctx context.Context, req *rawatjalanpb.GetMasterICD10ByPoliRequest) (*rawatjalanpb.GetMasterICD10ByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetMasterICD10ByPoliResponse, error) {
		return a.client.GetMasterICD10ByPoli(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetMasterKBMsByPoli(ctx context.Context, req *rawatjalanpb.GetMasterKBMsByPoliRequest) (*rawatjalanpb.GetMasterKBMsByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetMasterKBMsByPoliResponse, error) {
		return a.client.GetMasterKBMsByPoli(ctx, req)
	})
}
func (a *RawatJalanAdapter) GetPolyclinics(ctx context.Context, req *rawatjalanpb.GetPolyclinicsRequest) (*rawatjalanpb.GetPolyclinicsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*rawatjalanpb.GetPolyclinicsResponse, error) {
		return a.client.GetPolyclinics(ctx, req)
	})
}

// ── Pharmacy ──────────────────────────────────────────────────────────────────

type PharmacyAdapter struct {
	client pharmacypb.PharmacyServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewPharmacyAdapter(client pharmacypb.PharmacyServiceClient, cb *gobreaker.CircuitBreaker) *PharmacyAdapter {
	return &PharmacyAdapter{client: client, cb: cb}
}

func (a *PharmacyAdapter) CreatePrescription(ctx context.Context, req *pharmacypb.CreatePrescriptionRequest) (*pharmacypb.CreatePrescriptionResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.CreatePrescriptionResponse, error) {
		return a.client.CreatePrescription(ctx, req)
	})
}
func (a *PharmacyAdapter) DispensePrescription(ctx context.Context, req *pharmacypb.DispensePrescriptionRequest) (*pharmacypb.DispensePrescriptionResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.DispensePrescriptionResponse, error) {
		return a.client.DispensePrescription(ctx, req)
	})
}
func (a *PharmacyAdapter) GetMasterObat(ctx context.Context, req *pharmacypb.GetMasterObatRequest) (*pharmacypb.GetMasterObatResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.GetMasterObatResponse, error) {
		return a.client.GetMasterObat(ctx, req)
	})
}
func (a *PharmacyAdapter) GetMasterObatByPoli(ctx context.Context, req *pharmacypb.GetMasterObatByPoliRequest) (*pharmacypb.GetMasterObatByPoliResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.GetMasterObatByPoliResponse, error) {
		return a.client.GetMasterObatByPoli(ctx, req)
	})
}
func (a *PharmacyAdapter) GetMasterKFA(ctx context.Context, req *pharmacypb.GetMasterKFARequest) (*pharmacypb.GetMasterKFAResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.GetMasterKFAResponse, error) {
		return a.client.GetMasterKFA(ctx, req)
	})
}
func (a *PharmacyAdapter) GetMasterDPHO(ctx context.Context, req *pharmacypb.GetMasterDPHORequest) (*pharmacypb.GetMasterDPHOResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.GetMasterDPHOResponse, error) {
		return a.client.GetMasterDPHO(ctx, req)
	})
}
func (a *PharmacyAdapter) GetObatMappingDetails(ctx context.Context, req *pharmacypb.GetObatMappingDetailsRequest) (*pharmacypb.GetObatMappingDetailsResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*pharmacypb.GetObatMappingDetailsResponse, error) {
		return a.client.GetObatMappingDetails(ctx, req)
	})
}

// ── Billing ───────────────────────────────────────────────────────────────────

type BillingAdapter struct {
	client billingpb.BillingServiceClient
	cb     *gobreaker.CircuitBreaker
}

func NewBillingAdapter(client billingpb.BillingServiceClient, cb *gobreaker.CircuitBreaker) *BillingAdapter {
	return &BillingAdapter{client: client, cb: cb}
}

func (a *BillingAdapter) GetInvoicesByEncounter(ctx context.Context, req *billingpb.GetInvoicesByEncounterRequest) (*billingpb.GetInvoicesByEncounterResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.GetInvoicesByEncounterResponse, error) {
		return a.client.GetInvoicesByEncounter(ctx, req)
	})
}
func (a *BillingAdapter) GenerateInvoice(ctx context.Context, req *billingpb.GenerateInvoiceRequest) (*billingpb.GenerateInvoiceResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.GenerateInvoiceResponse, error) {
		return a.client.GenerateInvoice(ctx, req)
	})
}
func (a *BillingAdapter) PayInvoice(ctx context.Context, req *billingpb.PayInvoiceRequest) (*billingpb.PayInvoiceResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.PayInvoiceResponse, error) {
		return a.client.PayInvoice(ctx, req)
	})
}
func (a *BillingAdapter) CancelInvoice(ctx context.Context, req *billingpb.CancelInvoiceRequest) (*billingpb.CancelInvoiceResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.CancelInvoiceResponse, error) {
		return a.client.CancelInvoice(ctx, req)
	})
}
func (a *BillingAdapter) AddRegistrationFee(ctx context.Context, req *billingpb.AddRegistrationFeeRequest) (*billingpb.AddRegistrationFeeResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.AddRegistrationFeeResponse, error) {
		return a.client.AddRegistrationFee(ctx, req)
	})
}
func (a *BillingAdapter) GetActionPaymentStatus(ctx context.Context, req *billingpb.GetActionPaymentStatusRequest) (*billingpb.GetActionPaymentStatusResponse, error) {
	return circuitbreaker.CallGRPC(a.cb, func() (*billingpb.GetActionPaymentStatusResponse, error) {
		return a.client.GetActionPaymentStatus(ctx, req)
	})
}
