#include<iostream>
#include<vector>
#include<algorithm>
using namespace std;
void array_demo(){
    const int n = 10;
    vector< int > v = {9, 3, 0, 2, 5, 6, 4, 7, 1, 8};
    vector< int > id = {3, 5, 6};
    for(int i = 0; i < n; ++i){
        v[i] += 1;
    }
}
void graph(){
    const int n = 10;
    vector<vector<int>> adjcent_matrix(n,vector<int>(n,0));
    vector<vector<int>> adjcent_list(n);
     for(int i = 0;i < n;i++){
        for(int j = 0;j < n;j++){
            if(i < j){
                adjcent_list[i].push_back(j);
                adjcent_matrix[i][j] = 67;
            }
        }
    }
    return;
}
void bub_sort(vector< int > v){
    int n = v.size();
    for(int i = 0; i < n; ++i){
        for(int j = 0; j < n - i - 1; ++j){
            if(v[j + 1] < v[j]) swap(v[j + 1], v[j]);
        }
    }
}
void sel_sort(vector< int > v){
    int n = v.size();
    for(int i = 0; i < n; ++i){
        int mn = i;
        for(int j = i + 1; j < n; ++j){
            if(v[mn] > v[j]) mn = j;
        }
        swap(v[i], v[mn]);
    }
}
void i_sieve(int n){
    vector< int > not_prime(n + 1);
    for(int i = 2; i <= n; ++i){
        if(!not_prime[i]){
            for(int j = i * i; j <= n; j += i){
                not_prime[j] = 1;
            }
        }
    }
}
void dp(){
    int n = 4, x = 10;
    vector< int > wei = {0, 4, 3, 6, 2};
    vector< int > val = {0, 5, 3, 7, 1};
    vector< vector< int > > dp(n + 1, vector< int >(x + 1));
    for(int i = 1; i <= n; ++i){
        int v = val[i], w = wei[i];
        for(int j = w; j <= x; ++j){
            int p_i = i - 1, p_j = j - w;
            dp[i][j] = max(dp[i][j], dp[i - 1][j - w] + v);
        }
    }
}
void eulr_sieve(int n){
    vector< int > prime, not_prime(n + 1);
    for(int i = 2; i <= n; ++i){
        if(!not_prime[i]){
            prime.push_back(i);
        }
        for(int p : prime){
            int j = i * p;
            if(j > n) break;
            not_prime[j] = 1;
            if(i % p == 0) break;
        }
    }
}
void fsort(int l, int r, vector< int > &v){
    if(l == r) return;
    int mid = (l + r) >> 1;
    fsort(l, mid, v);
    fsort(mid + 1, r, v);
    vector< int > tmp(r - l + 1);
    for(int k = 0, i = l, j = mid + 1; k < r - l + 1; ++k){
        if(i > mid) tmp[k] = v[j++];
        else if(j > r) tmp[k] = v[i++];
        else if(v[i] > v[j]) tmp[k] = v[j++];
        else tmp[k] = v[i++];
    }
    for(int i = l; i <= r; ++i){
        v[i] = tmp[i - l];
    }
    return;
}
int l_bound(int t, vector< int > v){
    sort(v.begin(), v.end());
    int l = 0, r = (int)v.size() - 1, ans = r + 1;
    while(l <= r){
        int mid = (l + r) >> 1;
        if(v[mid] >= t){
            ans = mid;
            r = mid - 1;
        }
        else l = mid + 1;
    }
    return ans;
}
int main(){
    // array_demo();
    vector< int > v = {15, 3, 11, 5, 14, 1, 9, 6, 16, 10, 12, 4, 7, 2, 13, 8};
    // vector< int > u = {11, 6, 8, 3, 7, 12, 5, 9, 2, 10, 1, 4};
    // bub_sort(v);
    // i_sieve(100);
    // eulr_sieve(50);
    // sel_sort(v);
    dp();
    // fsort(0, (int)v.size() - 1, v);
    // l_bound(5, v);
}