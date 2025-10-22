// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package opencode_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/sst/zeus-sdk-go"
	"github.com/sst/zeus-sdk-go/internal/testutil"
	"github.com/sst/zeus-sdk-go/option"
)

func TestAppLogWithOptionalParams(t *testing.T) {
	t.Skip("Prism tests are disabled")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := zeus.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.App.Log(context.TODO(), zeus.AppLogParams{
		Level:     zeus.F(zeus.AppLogParamsLevelDebug),
		Message:   zeus.F("message"),
		Service:   zeus.F("service"),
		Directory: zeus.F("directory"),
		Extra: zeus.F(map[string]interface{}{
			"foo": "bar",
		}),
	})
	if err != nil {
		var apierr *zeus.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestAppProvidersWithOptionalParams(t *testing.T) {
	t.Skip("Prism tests are disabled")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := zeus.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.App.Providers(context.TODO(), zeus.AppProvidersParams{
		Directory: zeus.F("directory"),
	})
	if err != nil {
		var apierr *zeus.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}
