package handlers

import (
	"net/http"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
)


type QueueEstimatorHandler struct {
	emrClient      emrpb.EMRServiceClient
	pharmacyClient pharmacypb.PharmacyServiceClient
}

func NewQueueEstimatorHandler(emrClient emrpb.EMRServiceClient, pharmacyClient pharmacypb.PharmacyServiceClient) *QueueEstimatorHandler {
	return &QueueEstimatorHandler{
		emrClient:      emrClient,
		pharmacyClient: pharmacyClient,
	}
}

func (h *QueueEstimatorHandler) EstimateClinicWaitTime(w http.ResponseWriter, r *http.Request) {
	doctorID := r.URL.Query().Get("doctor_id")
	deptCode := r.URL.Query().Get("department_code")
	gender := r.URL.Query().Get("gender")
	ageBracket := r.URL.Query().Get("age_bracket")

	req := &emrpb.GetEstimatedWaitTimeRequest{
		DoctorId:       doctorID,
		DepartmentCode: deptCode,
		Gender:         gender,
		AgeBracket:     ageBracket,
	}

	res, err := h.emrClient.GetEstimatedWaitTime(r.Context(), req)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
			Success: false,
			Message: "failed to get clinic estimate: " + err.Error(),
		})
		return
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Data: map[string]interface{}{
			"estimated_minutes": res.EstimatedMinutes,
		},
	})
}

func (h *QueueEstimatorHandler) EstimatePharmacyWaitTime(w http.ResponseWriter, r *http.Request) {
	doctorID := r.URL.Query().Get("doctor_id")
	deptCode := r.URL.Query().Get("department_code")
	gender := r.URL.Query().Get("gender")
	ageBracket := r.URL.Query().Get("age_bracket")
	isCompoundedStr := r.URL.Query().Get("is_compounded")
	
	isCompounded := false
	if isCompoundedStr == "true" {
		isCompounded = true
	}

	req := &pharmacypb.GetEstimatedWaitTimeRequest{
		DoctorId:       doctorID,
		DepartmentCode: deptCode,
		Gender:         gender,
		AgeBracket:     ageBracket,
		IsCompounded:   isCompounded,
	}

	res, err := h.pharmacyClient.GetEstimatedWaitTime(r.Context(), req)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
			Success: false,
			Message: "failed to get pharmacy estimate: " + err.Error(),
		})
		return
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Data: map[string]interface{}{
			"estimated_minutes": res.EstimatedMinutes,
		},
	})
}
