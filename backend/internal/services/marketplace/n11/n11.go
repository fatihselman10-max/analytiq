package n11

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/analytiq/backend/internal/services/marketplace"
)

// N11 uses SOAP API
const orderServiceURL = "https://api.n11.com/ws/OrderService.wsdl"
const productServiceURL = "https://api.n11.com/ws/ProductService.wsdl"

type Client struct {
	apiKey    string
	apiSecret string
	http      *http.Client
}

func NewClient(apiKey, apiSecret string) *Client {
	return &Client{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		http:      &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) GetPlatformName() string {
	return "n11"
}

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.GetOrders(ctx, time.Now().AddDate(0, 0, -1), time.Now(), 0)
	return err
}

func (c *Client) GetOrders(ctx context.Context, startDate, endDate time.Time, page int) (*marketplace.OrdersResponse, error) {
	soapBody := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
	<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
		<soapenv:Body>
			<sch:OrderListRequest>
				<auth>
					<appKey>%s</appKey>
					<appSecret>%s</appSecret>
				</auth>
				<searchData>
					<buyerName/>
					<orderNumber/>
					<productSellerCode/>
					<recipient/>
					<period>
						<startDate>%s</startDate>
						<endDate>%s</endDate>
					</period>
					<sortForUpdateDate>true</sortForUpdateDate>
				</searchData>
				<pagingData>
					<currentPage>%d</currentPage>
					<pageSize>50</pageSize>
				</pagingData>
			</sch:OrderListRequest>
		</soapenv:Body>
	</soapenv:Envelope>`,
		c.apiKey, c.apiSecret,
		startDate.Format("02/01/2006"),
		endDate.Format("02/01/2006"),
		page)

	body, err := c.doSOAPRequest(ctx, orderServiceURL, soapBody)
	if err != nil {
		return nil, err
	}

	var resp n11OrderListResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse SOAP response: %w", err)
	}

	orders := make([]marketplace.Order, 0)
	for _, o := range resp.Body.Response.OrderList {
		orderDate, _ := time.Parse("02/01/2006 15:04:05", o.CreateDate)
		order := marketplace.Order{
			PlatformOrderID: o.ID,
			Status:          mapN11Status(o.Status),
			CustomerName:    o.Buyer,
			Currency:        "TRY",
			TotalAmount:     o.TotalAmount,
			OrderDate:       orderDate,
		}
		orders = append(orders, order)
	}

	totalCount := resp.Body.Response.PagingData.TotalCount
	return &marketplace.OrdersResponse{
		Orders:     orders,
		TotalCount: totalCount,
		Page:       page,
		HasMore:    (page+1)*50 < totalCount,
	}, nil
}

func (c *Client) GetProducts(ctx context.Context, page int) (*marketplace.ProductsResponse, error) {
	soapBody := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
	<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
		<soapenv:Body>
			<sch:GetProductListRequest>
				<auth>
					<appKey>%s</appKey>
					<appSecret>%s</appSecret>
				</auth>
				<pagingData>
					<currentPage>%d</currentPage>
					<pageSize>50</pageSize>
				</pagingData>
			</sch:GetProductListRequest>
		</soapenv:Body>
	</soapenv:Envelope>`, c.apiKey, c.apiSecret, page)

	body, err := c.doSOAPRequest(ctx, productServiceURL, soapBody)
	if err != nil {
		return nil, err
	}

	var resp n11ProductListResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	products := make([]marketplace.Product, 0)
	for _, p := range resp.Body.Response.Products {
		products = append(products, marketplace.Product{
			PlatformProductID: p.ID,
			SKU:               p.ProductSellerCode,
			Name:              p.Title,
			Price:             p.Price,
			Stock:             p.Stock,
			ImageURL:          p.ImageURL,
		})
	}

	totalCount := resp.Body.Response.PagingData.TotalCount
	return &marketplace.ProductsResponse{
		Products:   products,
		TotalCount: totalCount,
		Page:       page,
		HasMore:    (page+1)*50 < totalCount,
	}, nil
}

func (c *Client) GetOrderDetail(ctx context.Context, orderID string) (*marketplace.OrderDetail, error) {
	soapBody := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
	<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
		<soapenv:Body>
			<sch:OrderDetailRequest>
				<auth>
					<appKey>%s</appKey>
					<appSecret>%s</appSecret>
				</auth>
				<orderRequest>
					<id>%s</id>
				</orderRequest>
			</sch:OrderDetailRequest>
		</soapenv:Body>
	</soapenv:Envelope>`, c.apiKey, c.apiSecret, orderID)

	body, err := c.doSOAPRequest(ctx, orderServiceURL, soapBody)
	if err != nil {
		return nil, err
	}

	var resp n11OrderDetailResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	od := resp.Body.Response.Order
	orderDate, _ := time.Parse("02/01/2006 15:04:05", od.CreateDate)

	order := marketplace.Order{
		PlatformOrderID: od.ID,
		Status:          mapN11Status(od.Status),
		CustomerName:    od.Buyer,
		Currency:        "TRY",
		TotalAmount:     od.TotalAmount,
		OrderDate:       orderDate,
	}

	for _, item := range od.Items {
		order.Items = append(order.Items, marketplace.OrderItem{
			ProductID:   item.ProductID,
			SKU:         item.SellerCode,
			ProductName: item.ProductName,
			Quantity:    item.Quantity,
			UnitPrice:   item.Price,
			TotalPrice:  item.Price * float64(item.Quantity),
		})
	}

	return &marketplace.OrderDetail{Order: order}, nil
}

func (c *Client) doSOAPRequest(ctx context.Context, url, soapBody string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(soapBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SOAP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("SOAP error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

func mapN11Status(status string) string {
	switch status {
	case "New", "Approved":
		return "pending"
	case "Rejected":
		return "cancelled"
	case "Shipped":
		return "shipped"
	case "Delivered":
		return "delivered"
	case "Completed":
		return "completed"
	default:
		return "unknown"
	}
}

// N11 SOAP XML types
type n11OrderListResponse struct {
	XMLName xml.Name `xml:"Envelope"`
	Body    struct {
		Response struct {
			OrderList  []n11Order `xml:"orderList>order"`
			PagingData struct {
				TotalCount int `xml:"totalCount"`
			} `xml:"pagingData"`
		} `xml:"OrderListResponse"`
	} `xml:"Body"`
}

type n11Order struct {
	ID          string  `xml:"id"`
	Status      string  `xml:"status"`
	Buyer       string  `xml:"buyer"`
	CreateDate  string  `xml:"createDate"`
	TotalAmount float64 `xml:"totalAmount"`
}

type n11OrderDetailResponse struct {
	XMLName xml.Name `xml:"Envelope"`
	Body    struct {
		Response struct {
			Order n11OrderDetail `xml:"orderDetail"`
		} `xml:"OrderDetailResponse"`
	} `xml:"Body"`
}

type n11OrderDetail struct {
	ID          string          `xml:"id"`
	Status      string          `xml:"status"`
	Buyer       string          `xml:"buyer"`
	CreateDate  string          `xml:"createDate"`
	TotalAmount float64         `xml:"totalAmount"`
	Items       []n11OrderItem  `xml:"itemList>item"`
}

type n11OrderItem struct {
	ProductID   string  `xml:"productId"`
	SellerCode  string  `xml:"productSellerCode"`
	ProductName string  `xml:"productName"`
	Quantity    int     `xml:"quantity"`
	Price       float64 `xml:"price"`
}

type n11ProductListResponse struct {
	XMLName xml.Name `xml:"Envelope"`
	Body    struct {
		Response struct {
			Products   []n11Product `xml:"products>product"`
			PagingData struct {
				TotalCount int `xml:"totalCount"`
			} `xml:"pagingData"`
		} `xml:"GetProductListResponse"`
	} `xml:"Body"`
}

type n11Product struct {
	ID                string  `xml:"id"`
	Title             string  `xml:"title"`
	ProductSellerCode string  `xml:"productSellerCode"`
	Price             float64 `xml:"displayPrice"`
	Stock             int     `xml:"stockItems>stockItem>quantity"`
	ImageURL          string  `xml:"images>image>url"`
}
